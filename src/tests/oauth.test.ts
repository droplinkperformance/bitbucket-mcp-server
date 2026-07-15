import { describe, it, expect } from 'vitest';
import { OAuthProvider } from '../auth/OAuthProvider.js';
import { MemoryTokenStore } from '../auth/token-store/MemoryTokenStore.js';
import type { TokenBundle } from '../auth/token-store/TokenStore.js';

class StubOAuthService {
  refreshCalls: string[] = [];
  constructor(private readonly sequence: TokenBundle[]) {}

  buildAuthorizeUrl(): string {
    return 'https://authorize';
  }
  async exchangeAuthorizationCode(): Promise<TokenBundle> {
    return this.sequence[0]!;
  }
  async refresh(refreshToken: string): Promise<TokenBundle> {
    this.refreshCalls.push(refreshToken);
    return this.sequence[this.refreshCalls.length]!;
  }
}

describe('OAuthProvider', () => {
  it('refreshes when there is no valid access token and persists rotated refresh token', async () => {
    const store = new MemoryTokenStore({ accessToken: '', refreshToken: 'r0' });
    const service = new StubOAuthService([
      { accessToken: 'ignored', refreshToken: 'r0' },
      { accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() + 3_600_000 },
    ]);
    const provider = new OAuthProvider({ service: service as never, store });

    const token = await provider.getAccessToken();
    expect(token).toBe('a1');
    expect(service.refreshCalls).toEqual(['r0']);

    // Rotated refresh token must be persisted.
    const persisted = await store.load();
    expect(persisted?.refreshToken).toBe('r1');
  });

  it('reuses a still-valid access token without refreshing', async () => {
    const store = new MemoryTokenStore({
      accessToken: 'valid',
      refreshToken: 'r0',
      expiresAt: Date.now() + 3_600_000,
    });
    const service = new StubOAuthService([{ accessToken: 'should-not-be-used' }]);
    const provider = new OAuthProvider({ service: service as never, store });

    expect(await provider.getAccessToken()).toBe('valid');
    expect(service.refreshCalls).toEqual([]);
  });

  it('keeps the previous refresh token when the response omits a new one', async () => {
    const store = new MemoryTokenStore({ accessToken: '', refreshToken: 'r0' });
    const service = new StubOAuthService([
      { accessToken: 'ignored', refreshToken: 'r0' },
      { accessToken: 'a1', expiresAt: Date.now() + 3_600_000 },
    ]);
    const provider = new OAuthProvider({ service: service as never, store });

    await provider.getAccessToken();
    const persisted = await store.load();
    expect(persisted?.refreshToken).toBe('r0');
  });

  it('throws when no refresh token is available', async () => {
    const store = new MemoryTokenStore(null as never);
    const service = new StubOAuthService([{ accessToken: 'x' }]);
    const provider = new OAuthProvider({ service: service as never, store });
    await expect(provider.getAccessToken()).rejects.toThrow(/refresh token/i);
  });

  it('logout clears the store', async () => {
    const store = new MemoryTokenStore({ accessToken: 'a', refreshToken: 'r' });
    const service = new StubOAuthService([{ accessToken: 'a' }]);
    const provider = new OAuthProvider({ service: service as never, store });
    await provider.logout();
    expect(await store.load()).toBeNull();
  });
});
