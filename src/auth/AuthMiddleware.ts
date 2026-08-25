import type { AuthProvider } from './AuthProvider.js';
import { HttpStatus } from '../shared/http-status.js';
import { isHttpError, type HttpClient, type HttpRequest, type HttpResponse } from '../infrastructure/http/client.js';

/**
 * Wraps an HTTP client:
 *  - injects the Authorization header from AuthProvider on every request;
 *  - on a 401, refreshes once (OAuth only) and retries.
 *
 * This is provider-agnostic: it only talks to the `AuthProvider` interface.
 */
export function withAuth(http: HttpClient, authProvider: AuthProvider): HttpClient {
  return {
    async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
      const authorized = await withAuthorization(request, authProvider);
      try {
        return await http.request<T>(authorized);
      } catch (error) {
        if (
          !isHttpError(error) ||
          error.status !== HttpStatus.UNAUTHORIZED ||
          typeof authProvider.refresh !== 'function'
        ) {
          throw error;
        }
        try {
          await authProvider.refresh();
        } catch {
          throw error;
        }
        const retried = await withAuthorization(request, authProvider);
        return http.request<T>(retried);
      }
    },
  };
}

async function withAuthorization(request: HttpRequest, authProvider: AuthProvider): Promise<HttpRequest> {
  const header = await authProvider.getAuthorizationHeader();
  return {
    ...request,
    headers: { ...request.headers, Authorization: header },
  };
}
