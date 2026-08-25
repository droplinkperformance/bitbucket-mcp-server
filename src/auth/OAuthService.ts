import type { TokenBundle } from './token-store/TokenStore.js';
import { AuthError } from '../shared/errors.js';
import { createHttpClient, isHttpError, type HttpClient } from '../infrastructure/http/client.js';

export interface OAuthServiceOptions {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri?: string;
  http?: HttpClient;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  scopes?: string;
  token_type?: string;
}

/**
 * Talks to the Bitbucket Cloud OAuth 2.0 token endpoint.
 *
 * Notes baked in:
 *  - Client credentials go in the HTTP Basic Authorization header.
 *  - Bodies are application/x-www-form-urlencoded.
 *  - Refresh tokens ROTATE: every refresh returns a new refresh token that must
 *    be persisted; the old one is invalidated shortly after.
 *  - The response field is `scope` (older payloads used `scopes`).
 */
export class OAuthService {
  private readonly http: HttpClient;

  constructor(private readonly options: OAuthServiceOptions) {
    this.http = options.http ?? createHttpClient({ timeoutMs: 30_000 });
  }

  buildAuthorizeUrl(state?: string): string {
    const url = new URL(this.options.authorizeUrl);
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('response_type', 'code');
    if (this.options.redirectUri) {
      url.searchParams.set('redirect_uri', this.options.redirectUri);
    }
    if (state) {
      url.searchParams.set('state', state);
    }
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenBundle> {
    const body = new URLSearchParams({ grant_type: 'authorization_code', code });
    if (this.options.redirectUri) {
      body.set('redirect_uri', this.options.redirectUri);
    }
    return this.requestToken(body);
  }

  async refresh(refreshToken: string): Promise<TokenBundle> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return this.requestToken(body);
  }

  private async requestToken(body: URLSearchParams): Promise<TokenBundle> {
    const basic = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString(
      'base64',
    );
    try {
      const response = await this.http.request<RawTokenResponse>({
        method: 'POST',
        url: this.options.tokenUrl,
        body,
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: 'application/json',
        },
      });
      return this.toBundle(response.data);
    } catch (error) {
      if (isHttpError(error)) {
        throw new AuthError('Bitbucket OAuth token request failed.', {
          status: error.status,
          error: error.data,
        });
      }
      throw new AuthError('Bitbucket OAuth token request failed.', error);
    }
  }

  private toBundle(raw: RawTokenResponse): TokenBundle {
    if (!raw.access_token) {
      throw new AuthError('OAuth response did not contain an access_token.');
    }
    const expiresAt =
      typeof raw.expires_in === 'number' ? Date.now() + raw.expires_in * 1000 : undefined;
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresAt,
      scope: raw.scope ?? raw.scopes,
      tokenType: raw.token_type,
    };
  }
}
