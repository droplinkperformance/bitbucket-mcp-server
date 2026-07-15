import { isRetryableStatus } from '../shared/http-status.js';
import type {
  HeaderBag,
  RateLimitInfo,
  RateLimitStrategy,
  RetryDecision,
  RetryDecisionInput,
} from './RateLimitStrategy.js';

export interface BitbucketRateLimitOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Injectable for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

function firstHeader(headers: HeaderBag, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return String(value);
}

/**
 * Bitbucket Cloud rate-limit handling: parses `Retry-After` and
 * `X-RateLimit-*` headers, then applies exponential backoff with full jitter,
 * capped at `maxDelayMs`, for transient (429/5xx) failures.
 */
export class BitbucketRateLimitStrategy implements RateLimitStrategy {
  private readonly random: () => number;
  private quota: RateLimitInfo | undefined;

  constructor(private readonly options: BitbucketRateLimitOptions) {
    this.random = options.random ?? Math.random;
  }

  parseHeaders(headers: HeaderBag): RateLimitInfo {
    const info: RateLimitInfo = {};

    const retryAfter = firstHeader(headers, 'retry-after');
    if (retryAfter !== undefined) {
      const asNumber = Number(retryAfter);
      if (Number.isFinite(asNumber)) {
        info.retryAfterMs = Math.max(0, asNumber * 1000);
      } else {
        const asDate = Date.parse(retryAfter);
        if (!Number.isNaN(asDate)) {
          info.retryAfterMs = Math.max(0, asDate - Date.now());
        }
      }
    }

    const limit = firstHeader(headers, 'x-ratelimit-limit');
    if (limit !== undefined && Number.isFinite(Number(limit))) {
      info.limit = Number(limit);
    }

    const remaining = firstHeader(headers, 'x-ratelimit-remaining');
    if (remaining !== undefined && Number.isFinite(Number(remaining))) {
      info.remaining = Number(remaining);
    }

    const reset = firstHeader(headers, 'x-ratelimit-reset');
    if (reset !== undefined && Number.isFinite(Number(reset))) {
      // Bitbucket reset headers are typically epoch seconds.
      info.resetAt = Number(reset) * 1000;
    }

    return info;
  }

  getRetryDecision(input: RetryDecisionInput): RetryDecision {
    const { attempt, status, info } = input;

    if (attempt >= this.options.maxRetries) {
      return { shouldRetry: false, delayMs: 0 };
    }

    const retryable = status === undefined ? this.isNetworkError(input.error) : isRetryableStatus(status);
    if (!retryable) {
      return { shouldRetry: false, delayMs: 0 };
    }

    // Honor explicit server guidance first.
    if (info?.retryAfterMs && info.retryAfterMs > 0) {
      return { shouldRetry: true, delayMs: Math.min(info.retryAfterMs, this.options.maxDelayMs) };
    }

    // Exponential backoff with full jitter.
    const exponential = this.options.baseDelayMs * 2 ** attempt;
    const capped = Math.min(exponential, this.options.maxDelayMs);
    const jittered = Math.floor(this.random() * capped);
    return { shouldRetry: true, delayMs: jittered };
  }

  recordQuota(info: RateLimitInfo): void {
    if (info.limit !== undefined || info.remaining !== undefined || info.resetAt !== undefined) {
      this.quota = { ...this.quota, ...info };
    }
  }

  getQuota(): RateLimitInfo | undefined {
    return this.quota;
  }

  private isNetworkError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const code = (error as { code?: string }).code;
    return (
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNABORTED' ||
      code === 'EAI_AGAIN' ||
      code === 'ENOTFOUND'
    );
  }
}
