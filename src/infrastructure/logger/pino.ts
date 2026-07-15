import pino, { type Logger } from 'pino';
import { maskingService } from '../../services/masking/Service.js';

let rootLogger: Logger | undefined;

/**
 * Build the root logger. Secrets are protected in two layers:
 *  - pino `redact` removes known sensitive keys/paths structurally;
 *  - the masking service scrubs token-like substrings from free-form messages.
 *
 * IMPORTANT: on the stdio transport, logs MUST go to stderr so they never
 * corrupt the JSON-RPC stream on stdout.
 */
export function createLogger(options: { level?: string; name?: string } = {}): Logger {
  return pino(
    {
      name: options.name ?? 'bitbucket-mcp-server',
      level: options.level ?? process.env.LOG_LEVEL ?? 'info',
      redact: {
        paths: [
          'authorization',
          'Authorization',
          '*.authorization',
          '*.Authorization',
          'headers.authorization',
          'headers.Authorization',
          'accessToken',
          'access_token',
          'refreshToken',
          'refresh_token',
          'clientSecret',
          'client_secret',
          'token',
          'password',
          'apiKey',
          'api_key',
          '*.accessToken',
          '*.refreshToken',
          '*.clientSecret',
        ],
        censor: '[REDACTED]',
      },
      formatters: {
        log(object) {
          return maskingService.mask(object) as Record<string, unknown>;
        },
      },
    },
    pino.destination(2),
  );
}

export function getLogger(): Logger {
  if (!rootLogger) {
    rootLogger = createLogger();
  }
  return rootLogger;
}

export function setLogger(logger: Logger): void {
  rootLogger = logger;
}

export type { Logger };
