import { describe, it, expect } from 'vitest';
import { BitbucketClient } from '../clients/bitbucket/BitbucketClient.js';
import { MemoryCacheProvider } from '../cache/MemoryCacheProvider.js';
import { BitbucketRateLimitStrategy } from '../ratelimit/BitbucketRateLimitStrategy.js';
import { silentLogger } from './helpers/fakes.js';
import {
  HttpError,
  type HttpClient,
  type HttpRequest,
  type HttpResponse,
} from '../infrastructure/http/client.js';

function ok<T>(data: T, headers: Record<string, string> = {}): HttpResponse<T> {
  return { data, status: 200, headers, url: 'https://api.bitbucket.org/2.0' };
}

function makeClient(
  handler: (request: HttpRequest) => Promise<HttpResponse<unknown>> | HttpResponse<unknown>,
  overrides: { maxRetries?: number } = {},
) {
  const http: HttpClient = {
    async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
      return (await handler(request)) as HttpResponse<T>;
    },
  };
  return new BitbucketClient({
    baseUrl: 'https://api.bitbucket.org/2.0',
    authProvider: {
      getAccessToken: async () => 'token',
      getAuthorizationHeader: async () => 'Bearer token',
    },
    rateLimit: new BitbucketRateLimitStrategy({
      maxRetries: overrides.maxRetries ?? 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      random: () => 0,
    }),
    cache: new MemoryCacheProvider(),
    logger: silentLogger(),
    sleep: async () => {},
    http,
  });
}

describe('BitbucketClient', () => {
  it('injects the bearer token from the auth provider', async () => {
    let seen: string | undefined;
    const client = makeClient(async (request) => {
      seen = request.headers?.Authorization;
      return ok({ ok: true });
    });
    await client.get('/user');
    expect(seen).toBe('Bearer token');
  });

  it('auto-paginates by following next links', async () => {
    const client = makeClient(async (request) => {
      const url = request.url ?? '';
      if (url.endsWith('/items') || url.includes('page=1')) {
        return ok({ values: [1, 2], next: 'https://api.bitbucket.org/2.0/items?page=2' });
      }
      return ok({ values: [3], next: undefined });
    });
    const items = await client.getPaginated<number>('/items');
    expect(items).toEqual([1, 2, 3]);
  });

  it('stops paginating at the limit', async () => {
    const client = makeClient(async () =>
      ok({ values: [1, 2, 3, 4, 5], next: 'https://api.bitbucket.org/2.0/items?page=2' }),
    );
    const items = await client.getPaginated<number>('/items', { limit: 3 });
    expect(items).toEqual([1, 2, 3]);
  });

  it('retries on 429 then succeeds', async () => {
    let calls = 0;
    const client = makeClient(async () => {
      calls += 1;
      if (calls === 1) {
        throw new HttpError('rate limited', {
          status: 429,
          headers: { 'retry-after': '0' },
          data: {},
          url: 'https://api.bitbucket.org/2.0/x',
        });
      }
      return ok({ ok: true });
    });
    const result = await client.get<{ ok: boolean }>('/x');
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('maps 404 to a NotFoundError', async () => {
    const client = makeClient(async () => {
      throw new HttpError('nf', {
        status: 404,
        headers: {},
        data: { error: 'x' },
        url: 'https://api.bitbucket.org/2.0/missing',
      });
    });
    await expect(client.get('/missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('caches GET responses when a ttl is provided', async () => {
    let calls = 0;
    const client = makeClient(async () => {
      calls += 1;
      return ok({ n: calls });
    });
    const first = await client.get<{ n: number }>('/cached', { cacheTtlSeconds: 60, cacheKey: 'k' });
    const second = await client.get<{ n: number }>('/cached', { cacheTtlSeconds: 60, cacheKey: 'k' });
    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });
});
