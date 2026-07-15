import type { TokenBundle, TokenStore } from './TokenStore.js';
import { ConfigError } from '../../shared/errors.js';

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<number>;
  quit(): Promise<unknown>;
}

/**
 * Redis-backed token store for horizontally-scaled / SaaS deployments where the
 * rotating refresh token must be shared across instances. `ioredis` is loaded
 * lazily so it stays an optional dependency.
 */
export class RedisTokenStore implements TokenStore {
  private clientPromise: Promise<RedisLike> | undefined;

  constructor(
    private readonly options: { url: string; key?: string; client?: RedisLike },
  ) {
    if (options.client) {
      this.clientPromise = Promise.resolve(options.client);
    }
  }

  private get key(): string {
    return this.options.key ?? 'bb:oauth:tokens';
  }

  private async getClient(): Promise<RedisLike> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        try {
          const mod = (await import('ioredis')) as unknown as {
            default: new (url: string) => RedisLike;
          };
          const RedisCtor = mod.default;
          return new RedisCtor(this.options.url);
        } catch (error) {
          throw new ConfigError(
            'TOKEN_STORE=redis requires the optional "ioredis" dependency to be installed.',
            error instanceof Error ? error.message : error,
          );
        }
      })();
    }
    return this.clientPromise;
  }

  async load(): Promise<TokenBundle | null> {
    const client = await this.getClient();
    const raw = await client.get(this.key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as TokenBundle;
    } catch {
      return null;
    }
  }

  async save(bundle: TokenBundle): Promise<void> {
    const client = await this.getClient();
    await client.set(this.key, JSON.stringify(bundle));
  }

  async clear(): Promise<void> {
    const client = await this.getClient();
    await client.del(this.key);
  }
}
