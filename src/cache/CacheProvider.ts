/**
 * Provider-agnostic cache contract. All caching in the system depends ONLY on
 * this interface, never on a concrete cache implementation.
 *
 * `ttl` is expressed in seconds. A missing/zero ttl means "use the provider
 * default" (which may be no expiry for some providers).
 */
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
