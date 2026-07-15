import type { TokenBundle, TokenStore } from './TokenStore.js';

/** Volatile token store. Useful for tests and ephemeral/stateless deployments. */
export class MemoryTokenStore implements TokenStore {
  private bundle: TokenBundle | null = null;

  constructor(seed?: TokenBundle) {
    this.bundle = seed ?? null;
  }

  async load(): Promise<TokenBundle | null> {
    return this.bundle;
  }

  async save(bundle: TokenBundle): Promise<void> {
    this.bundle = bundle;
  }

  async clear(): Promise<void> {
    this.bundle = null;
  }
}
