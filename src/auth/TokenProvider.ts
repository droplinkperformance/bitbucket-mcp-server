import type { AuthProvider } from './AuthProvider.js';
import { AuthError } from '../shared/errors.js';

/**
 * Static Bearer token auth (the secondary strategy). Reads a long-lived access
 * token from configuration. Cannot refresh.
 */
export class TokenProvider implements AuthProvider {
  constructor(private readonly accessToken: string) {
    if (!accessToken) {
      throw new AuthError('TokenProvider requires a non-empty access token.');
    }
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }

  async getAuthorizationHeader(): Promise<string> {
    return `Bearer ${this.accessToken}`;
  }
}
