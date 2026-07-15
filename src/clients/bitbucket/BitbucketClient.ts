import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type { AuthProvider } from '../../auth/AuthProvider.js';
import { installAuthMiddleware } from '../../auth/AuthMiddleware.js';
import type { CacheProvider } from '../../cache/CacheProvider.js';
import type { RateLimitStrategy } from '../../ratelimit/RateLimitStrategy.js';
import { appMetrics } from '../../telemetry/metrics.js';
import { maskingService } from '../../services/masking/Service.js';
import type { Logger } from '../../infrastructure/logger/pino.js';
import {
  AuthError,
  BitbucketApiError,
  NotFoundError,
  RateLimitError,
} from '../../shared/errors.js';
import { HttpStatus } from '../../shared/http-status.js';
import type { BitbucketPage } from './types.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface BitbucketRequestOptions {
  method?: HttpMethod;
  url: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  responseType?: 'json' | 'text';
  /** When set on a GET, the response is cached for this many seconds. */
  cacheTtlSeconds?: number;
  /** Explicit cache key; defaults to method+url+params. */
  cacheKey?: string;
}

export interface PaginateOptions {
  params?: Record<string, unknown>;
  /** Stop after collecting this many items (auto-pagination upper bound). */
  limit?: number;
}

export interface BitbucketClientOptions {
  baseUrl: string;
  authProvider: AuthProvider;
  rateLimit: RateLimitStrategy;
  cache: CacheProvider;
  logger: Logger;
  /** Injectable sleeper for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
  http?: AxiosInstance;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resilient wrapper over the Bitbucket Cloud REST API v2. Responsibilities:
 * authentication (via AuthProvider/AuthMiddleware), retry + rate limiting (via
 * RateLimitStrategy), caching (via CacheProvider), auto-pagination, metrics and
 * typed error mapping with secret masking.
 */
export class BitbucketClient {
  private readonly http: AxiosInstance;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: BitbucketClientOptions) {
    this.http =
      options.http ??
      axios.create({
        baseURL: options.baseUrl,
        timeout: 60_000,
        // Bitbucket returns JSON by default; diff endpoints return text.
        headers: { Accept: 'application/json' },
      });
    this.sleep = options.sleep ?? defaultSleep;
    installAuthMiddleware(this.http, options.authProvider);
  }

  async request<T>(options: BitbucketRequestOptions): Promise<T> {
    const method = options.method ?? 'GET';
    const cacheable = method === 'GET' && typeof options.cacheTtlSeconds === 'number';
    const cacheKey =
      options.cacheKey ?? `${method}:${options.url}:${JSON.stringify(options.params ?? {})}`;

    if (cacheable) {
      const cached = await this.options.cache.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const response = await this.rawRequest<T>(options);

    if (cacheable) {
      await this.options.cache.set(cacheKey, response.data, options.cacheTtlSeconds);
    }
    return response.data;
  }

  async get<T>(url: string, options: Omit<BitbucketRequestOptions, 'url' | 'method'> = {}): Promise<T> {
    return this.request<T>({ ...options, url, method: 'GET' });
  }

  async post<T>(url: string, data?: unknown, options: Omit<BitbucketRequestOptions, 'url' | 'method' | 'data'> = {}): Promise<T> {
    return this.request<T>({ ...options, url, method: 'POST', data });
  }

  async getText(url: string, options: Omit<BitbucketRequestOptions, 'url' | 'method' | 'responseType'> = {}): Promise<string> {
    return this.request<string>({ ...options, url, method: 'GET', responseType: 'text' });
  }

  /**
   * Auto-paginate a Bitbucket collection endpoint, following `next` links until
   * exhausted or `limit` items have been collected.
   */
  async getPaginated<T>(url: string, options: PaginateOptions = {}): Promise<T[]> {
    const collected: T[] = [];
    let nextUrl: string | undefined = url;
    let params: Record<string, unknown> | undefined = options.params;

    while (nextUrl) {
      const response: AxiosResponse<BitbucketPage<T>> = await this.rawRequest<BitbucketPage<T>>({
        url: nextUrl,
        method: 'GET',
        params,
      });
      const page = response.data;
      for (const value of page.values ?? []) {
        collected.push(value);
        if (options.limit !== undefined && collected.length >= options.limit) {
          return collected;
        }
      }
      // `next` is an absolute URL that already encodes pagination params.
      nextUrl = page.next;
      params = undefined;
    }

    return collected;
  }

  private async rawRequest<T>(options: BitbucketRequestOptions): Promise<AxiosResponse<T>> {
    const method = options.method ?? 'GET';
    let attempt = 0;

    for (;;) {
      const startedAt = Date.now();
      try {
        appMetrics.recordBitbucketCall({ method });
        const response = await this.http.request<T>({
          url: options.url,
          method,
          params: options.params,
          data: options.data,
          headers: options.headers,
          responseType: options.responseType === 'text' ? 'text' : 'json',
        });

        const info = this.options.rateLimit.parseHeaders(response.headers as Record<string, string>);
        this.options.rateLimit.recordQuota(info);
        appMetrics.recordLatency(Date.now() - startedAt, { method, status: response.status });
        this.options.logger.debug(
          maskingService.mask({ msg: 'bitbucket.request', method, url: options.url, status: response.status }),
        );
        return response;
      } catch (error) {
        appMetrics.recordLatency(Date.now() - startedAt, { method });
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const headers = axios.isAxiosError(error)
          ? ((error.response?.headers as Record<string, string>) ?? {})
          : {};
        const info = this.options.rateLimit.parseHeaders(headers);

        const decision = this.options.rateLimit.getRetryDecision({ attempt, status, info, error });
        if (decision.shouldRetry) {
          this.options.logger.warn(
            maskingService.mask({
              msg: 'bitbucket.retry',
              method,
              url: options.url,
              status,
              attempt: attempt + 1,
              delayMs: decision.delayMs,
            }),
          );
          await this.sleep(decision.delayMs);
          attempt += 1;
          continue;
        }

        appMetrics.recordError({ method, status: status ?? 0 });
        throw this.mapError(error, status, info.retryAfterMs);
      }
    }
  }

  private mapError(error: unknown, status: number | undefined, retryAfterMs?: number): Error {
    const details = axios.isAxiosError(error)
      ? maskingService.mask({ data: error.response?.data, url: error.config?.url })
      : maskingService.mask({ message: error instanceof Error ? error.message : String(error) });

    switch (status) {
      case HttpStatus.UNAUTHORIZED:
      case HttpStatus.FORBIDDEN:
        return new AuthError('Bitbucket authentication/authorization failed.', details);
      case HttpStatus.NOT_FOUND:
        return new NotFoundError('Bitbucket resource not found.', details);
      case HttpStatus.TOO_MANY_REQUESTS:
        return new RateLimitError('Bitbucket rate limit exceeded.', retryAfterMs, details);
      default:
        return new BitbucketApiError(
          'Bitbucket API request failed.',
          status ?? HttpStatus.BAD_GATEWAY,
          details,
        );
    }
  }
}
