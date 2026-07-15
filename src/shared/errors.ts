import { HttpStatus } from './http-status.js';

/**
 * Base error for the whole application. Carries an HTTP-ish status so the
 * transport / tool layer can map failures to a meaningful response without
 * leaking provider internals.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    this.code = options.code ?? 'internal_error';
    this.details = options.details;
  }
}

export class ConfigError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'config_error', details });
  }
}

export class AuthError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { status: HttpStatus.UNAUTHORIZED, code: 'auth_error', details });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { status: HttpStatus.NOT_FOUND, code: 'not_found', details });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number, details?: unknown) {
    super(message, { status: HttpStatus.TOO_MANY_REQUESTS, code: 'rate_limited', details });
    this.retryAfterMs = retryAfterMs;
  }
}

export class BitbucketApiError extends AppError {
  constructor(message: string, status: number, details?: unknown) {
    super(message, { status, code: 'bitbucket_api_error', details });
  }
}

export class LlmError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { status: HttpStatus.BAD_GATEWAY, code: 'llm_error', details });
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new AppError(error.message, { details: { name: error.name } });
  }
  return new AppError('Unknown error', { details: error });
}
