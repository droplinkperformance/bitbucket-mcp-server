import type { AuthProvider } from './AuthProvider.js';
import type { OAuthService } from './OAuthService.js';
import type { TokenBundle, TokenStore } from './token-store/TokenStore.js';
import { AuthError } from '../shared/errors.js';

export interface OAuthProviderOptions {
  service: OAuthService;
  store: TokenStore;
  /** Optional seed refresh token (e.g. from env) for headless bootstrapping. */
  initialRefreshToken?: string;
  /** Refresh this many ms before actual expiry to avoid mid-flight 401s. */
  expirySkewMs?: number;
}

/**
 * OAuth 2.0 (Authorization Code) auth provider. Depends ONLY on `TokenStore`
 * for persistence and `OAuthService` for endpoint calls.
 *
 * Handles login, refresh, rotating-refresh-token persistence, logout and
 * re-authentication. A single in-flight refresh promise prevents concurrent
 * refresh storms.
 */
export class OAuthProvider implements AuthProvider {
  private bundle: TokenBundle | null = null;
  private loaded = false;
  private refreshing: Promise<string> | null = null;
  private readonly skewMs: number;

  constructor(private readonly options: OAuthProviderOptions) {
    this.skewMs = options.expirySkewMs ?? 60_000;
  }

  /** Exchange an authorization code for tokens (login) and persist them. */
  async loginWithCode(code: string): Promise<TokenBundle> {
    const bundle = await this.options.service.exchangeAuthorizationCode(code);
    await this.persist(bundle);
    return bundle;
  }

  buildAuthorizeUrl(state?: string): string {
    return this.options.service.buildAuthorizeUrl(state);
  }

  async logout(): Promise<void> {
    this.bundle = null;
    this.loaded = true;
    await this.options.store.clear();
  }

  async getAccessToken(): Promise<string> {
    await this.ensureLoaded();

    if (this.bundle?.accessToken && !this.isExpired(this.bundle)) {
      return this.bundle.accessToken;
    }
    return this.refresh();
  }

  async getAuthorizationHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `Bearer ${token}`;
  }

  async refresh(): Promise<string> {
    if (this.refreshing) {
      return this.refreshing;
    }
    this.refreshing = this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<string> {
    await this.ensureLoaded();
    const refreshToken = this.bundle?.refreshToken;
    if (!refreshToken) {
      throw new AuthError(
        'No refresh token available. Complete the OAuth Authorization Code flow first (loginWithCode) or set a seed refresh token.',
      );
    }
    const next = await this.options.service.refresh(refreshToken);
    // Bitbucket rotates refresh tokens; persist whatever came back. If the
    // response omitted a new refresh token, keep the previous one.
    if (!next.refreshToken) {
      next.refreshToken = refreshToken;
    }
    await this.persist(next);
    return next.accessToken;
  }

  private async persist(bundle: TokenBundle): Promise<void> {
    this.bundle = bundle;
    this.loaded = true;
    await this.options.store.save(bundle);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const stored = await this.options.store.load();
    if (stored) {
      this.bundle = stored;
    } else if (this.options.initialRefreshToken) {
      this.bundle = { accessToken: '', refreshToken: this.options.initialRefreshToken };
    }
    this.loaded = true;
  }

  private isExpired(bundle: TokenBundle): boolean {
    if (!bundle.expiresAt) {
      // Unknown expiry: treat as expired so we proactively refresh once.
      return true;
    }
    return Date.now() >= bundle.expiresAt - this.skewMs;
  }
}
