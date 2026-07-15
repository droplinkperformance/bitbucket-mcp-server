import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCacheProvider } from '../cache/MemoryCacheProvider.js';

describe('MemoryCacheProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stores and retrieves values', async () => {
    const cache = new MemoryCacheProvider();
    await cache.set('k', { a: 1 });
    expect(await cache.get<{ a: number }>('k')).toEqual({ a: 1 });
  });

  it('returns null for missing keys', async () => {
    const cache = new MemoryCacheProvider();
    expect(await cache.get('missing')).toBeNull();
  });

  it('expires entries after their ttl', async () => {
    const cache = new MemoryCacheProvider();
    await cache.set('k', 'v', 10);
    expect(await cache.get('k')).toBe('v');
    vi.advanceTimersByTime(11_000);
    expect(await cache.get('k')).toBeNull();
  });

  it('deletes values', async () => {
    const cache = new MemoryCacheProvider();
    await cache.set('k', 'v');
    await cache.delete('k');
    expect(await cache.get('k')).toBeNull();
  });

  it('honors the default ttl', async () => {
    const cache = new MemoryCacheProvider({ defaultTtlSeconds: 5 });
    await cache.set('k', 'v');
    vi.advanceTimersByTime(6_000);
    expect(await cache.get('k')).toBeNull();
  });
});
