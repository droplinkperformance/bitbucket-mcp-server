import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { AuthProvider } from './AuthProvider.js';
import { HttpStatus } from '../shared/http-status.js';

interface RetriableConfig extends InternalAxiosRequestConfig {
  _authRetried?: boolean;
}

/**
 * Installs auth on an Axios instance:
 *  - request interceptor injects the Authorization header from AuthProvider;
 *  - response interceptor transparently refreshes once on a 401 and retries (OAuth only).
 *
 * This is provider-agnostic: it only talks to the `AuthProvider` interface.
 */
export function installAuthMiddleware(http: AxiosInstance, authProvider: AuthProvider): void {
  http.interceptors.request.use(async (config) => {
    const header = await authProvider.getAuthorizationHeader();
    config.headers.set('Authorization', header);
    return config;
  });

  http.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status;
      const config = error?.config as RetriableConfig | undefined;

      if (
        status === HttpStatus.UNAUTHORIZED &&
        config &&
        !config._authRetried &&
        typeof authProvider.refresh === 'function'
      ) {
        config._authRetried = true;
        try {
          await authProvider.refresh();
          const header = await authProvider.getAuthorizationHeader();
          config.headers?.set?.('Authorization', header);
        } catch {
          return Promise.reject(error);
        }
        return http.request(config);
      }

      return Promise.reject(error);
    },
  );
}
