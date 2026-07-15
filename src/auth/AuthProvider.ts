/**
 * Provider-agnostic authentication contract.
 *
 * The Bitbucket client (and any future SCM client) depends only on this; it
 * never knows whether the token came from a static Bearer token or a refreshed
 * OAuth flow.
 */
export interface AuthProvider {
  getAccessToken(): Promise<string>;
  /**
   * Full Authorization header value (e.g. `Bearer …` or `Basic …`).
   * Bitbucket API tokens (ATATT…) require Basic auth, not Bearer.
   */
  getAuthorizationHeader(): Promise<string>;
  /** Force a fresh access token (e.g. after a 401). Returns the new token. */
  refresh?(): Promise<string>;
}

/** Bitbucket Cloud API tokens issued via Atlassian account settings (prefix ATATT). */
export function isBitbucketApiToken(token: string): boolean {
  return token.startsWith('ATATT');
}
