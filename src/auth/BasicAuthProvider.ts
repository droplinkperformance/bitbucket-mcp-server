import type { AuthProvider } from './AuthProvider.js';
import { AuthError } from '../shared/errors.js';

/**
 * HTTP Basic authentication for Bitbucket Cloud.
 *
 * Supports:
 *  - **API tokens** (ATATT…): username = Atlassian account email, password = API token.
 *  - **App passwords** (legacy): username = Bitbucket username, password = app password.
 *
 * @see https://support.atlassian.com/bitbucket-cloud/docs/using-api-tokens/
 */
export class BasicAuthProvider implements AuthProvider {
  constructor(
    private readonly username: string,
    private readonly secret: string,
  ) {
    if (!username || !secret) {
      throw new AuthError('BasicAuthProvider requires a username (email) and access token.');
    }
  }

  async getAccessToken(): Promise<string> {
    return this.secret;
  }

  async getAuthorizationHeader(): Promise<string> {
    const encoded = Buffer.from(`${this.username}:${this.secret}`).toString('base64');
    return `Basic ${encoded}`;
  }
}
