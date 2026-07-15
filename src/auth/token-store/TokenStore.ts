/**
 * Persisted OAuth token bundle.
 *
 * `refreshToken` rotates: Bitbucket Cloud issues a new refresh token on every
 * refresh (enforced since 2026-05-04) and invalidates the previous one, so the
 * store MUST be updated after each refresh.
 */
export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
}

/**
 * Provider-agnostic persistence for OAuth tokens. `OAuthProvider` depends only
 * on this interface, never on a concrete (file/redis/memory) implementation.
 */
export interface TokenStore {
  load(): Promise<TokenBundle | null>;
  save(bundle: TokenBundle): Promise<void>;
  clear(): Promise<void>;
}
