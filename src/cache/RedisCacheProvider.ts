import type { CacheProvider } from './CacheProvider.js';
import { ConfigError } from '../shared/errors.js';

/** Minimal subset of the ioredis client used here; keeps ioredis optional. */
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<unknown>;
  del(key: string): Promise<number>;
  quit(): Promise<unknown>;
}

/**
 * Redis-backed cache. `ioredis` is an optional dependency: it is imported
 * lazily so the server runs without it unless CACHE_PROVIDER=redis is selected.
 */
export class RedisCacheProvider implements CacheProvider {
  private clientPromise: Promise<RedisLike> | undefined;

  constructor(
    private readonly options: {
      url: string;
      defaultTtlSeconds?: number;
      keyPrefix?: string;
      client?: RedisLike;
    },
  ) {
    if (options.client) {
      this.clientPromise = Promise.resolve(options.client);
    }
  }

  private async getClient(): Promise<RedisLike> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        try {
          const mod = (await import('ioredis')) as unknown as {
            default: new (url: string, opts?: Record<string, unknown>) => RedisLike;
          };
          const RedisCtor = mod.default;
          return new RedisCtor(this.options.url, {
            keyPrefix: this.options.keyPrefix,
            lazyConnect: false,
          });
        } catch (error) {
          throw new ConfigError(
            'CACHE_PROVIDER=redis requires the optional "ioredis" dependency to be installed.',
            error instanceof Error ? error.message : error,
          );
        }
      })();
    }
    return this.clientPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    const raw = await client.get(key);
    if (raw === null) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const client = await this.getClient();
    const serialized = JSON.stringify(value);
    const effectiveTtl = ttl ?? this.options.defaultTtlSeconds ?? 0;
    if (effectiveTtl > 0) {
      await client.set(key, serialized, 'EX', effectiveTtl);
    } else {
      await client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  async close(): Promise<void> {
    if (this.clientPromise) {
      const client = await this.clientPromise;
      await client.quit();
    }
  }
}
