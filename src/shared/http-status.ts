export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

export function isRetryableStatus(status: number): boolean {
  return (
    status === HttpStatus.TOO_MANY_REQUESTS ||
    status === HttpStatus.BAD_GATEWAY ||
    status === HttpStatus.SERVICE_UNAVAILABLE ||
    status === HttpStatus.GATEWAY_TIMEOUT ||
    status === HttpStatus.INTERNAL_SERVER_ERROR
  );
}
