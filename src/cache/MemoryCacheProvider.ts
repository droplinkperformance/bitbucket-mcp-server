import type { CacheProvider } from './CacheProvider.js';

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

/**
 * Default in-memory cache. TTL is enforced lazily on read and via an optional
 * periodic sweep to avoid unbounded growth.
 */
export class MemoryCacheProvider implements CacheProvider {
  private readonly store = new Map<string, Entry>();
  private readonly defaultTtlSeconds: number;

  constructor(options: { defaultTtlSeconds?: number } = {}) {
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 0;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this.defaultTtlSeconds;
    const expiresAt = effectiveTtl > 0 ? Date.now() + effectiveTtl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
