import { describe, it, expect } from 'vitest';
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { BitbucketClient } from '../clients/bitbucket/BitbucketClient.js';
import { MemoryCacheProvider } from '../cache/MemoryCacheProvider.js';
import { BitbucketRateLimitStrategy } from '../ratelimit/BitbucketRateLimitStrategy.js';
import { silentLogger } from './helpers/fakes.js';

function response(config: any, data: unknown, status = 200, headers: Record<string, string> = {}): AxiosResponse {
  return { data, status, statusText: 'OK', headers, config };
}

function makeClient(adapter: AxiosAdapter, overrides: { maxRetries?: number } = {}) {
  const http = axios.create({ adapter, baseURL: 'https://api.bitbucket.org/2.0' });
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
    const client = makeClient(async (config) => {
      seen = config.headers?.Authorization as string | undefined;
      return response(config, { ok: true });
    });
    await client.get('/user');
    expect(seen).toBe('Bearer token');
  });

  it('auto-paginates by following next links', async () => {
    const client = makeClient(async (config) => {
      const url = config.url ?? '';
      if (url.endsWith('/items') || url.includes('page=1')) {
        return response(config, { values: [1, 2], next: 'https://api.bitbucket.org/2.0/items?page=2' });
      }
      return response(config, { values: [3], next: undefined });
    });
    const items = await client.getPaginated<number>('/items');
    expect(items).toEqual([1, 2, 3]);
  });

  it('stops paginating at the limit', async () => {
    const client = makeClient(async (config) =>
      response(config, { values: [1, 2, 3, 4, 5], next: 'https://api.bitbucket.org/2.0/items?page=2' }),
    );
    const items = await client.getPaginated<number>('/items', { limit: 3 });
    expect(items).toEqual([1, 2, 3]);
  });

  it('retries on 429 then succeeds', async () => {
    let calls = 0;
    const client = makeClient(async (config) => {
      calls += 1;
      if (calls === 1) {
        throw new AxiosError('rate limited', 'ERR', config, null, response(config, {}, 429, { 'retry-after': '0' }));
      }
      return response(config, { ok: true });
    });
    const result = await client.get<{ ok: boolean }>('/x');
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('maps 404 to a NotFoundError', async () => {
    const client = makeClient(async (config) => {
      throw new AxiosError('nf', 'ERR', config, null, response(config, { error: 'x' }, 404));
    });
    await expect(client.get('/missing')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('caches GET responses when a ttl is provided', async () => {
    let calls = 0;
    const client = makeClient(async (config) => {
      calls += 1;
      return response(config, { n: calls });
    });
    const first = await client.get<{ n: number }>('/cached', { cacheTtlSeconds: 60, cacheKey: 'k' });
    const second = await client.get<{ n: number }>('/cached', { cacheTtlSeconds: 60, cacheKey: 'k' });
    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });
});
