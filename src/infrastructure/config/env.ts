import { z } from 'zod';
import { ConfigError } from '../../shared/errors.js';

const booleanFromString = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .transform((value) => value === '1' || value === 'true' || value === 'yes' || value === 'on');

const EnvSchema = z.object({
  // Transport
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().positive().default(3000),

  // Bitbucket API
  BITBUCKET_API_BASE_URL: z.string().url().default('https://api.bitbucket.org/2.0'),
  BITBUCKET_DEFAULT_WORKSPACE: z.string().optional(),

  // Auth
  BITBUCKET_ACCESS_TOKEN: z.string().optional(),
  /** Atlassian account email — required with API tokens (ATATT…). */
  BITBUCKET_EMAIL: z.string().email().optional(),
  /** Bitbucket username — alternative to email for legacy app passwords. */
  BITBUCKET_USERNAME: z.string().optional(),
  BITBUCKET_CLIENT_ID: z.string().optional(),
  BITBUCKET_CLIENT_SECRET: z.string().optional(),
  /** Optional seed refresh token for headless OAuth bootstrapping. */
  BITBUCKET_REFRESH_TOKEN: z.string().optional(),
  BITBUCKET_OAUTH_REDIRECT_URI: z.string().optional(),
  BITBUCKET_AUTHORIZE_URL: z.string().url().default('https://bitbucket.org/site/oauth2/authorize'),
  BITBUCKET_TOKEN_URL: z.string().url().default('https://bitbucket.org/site/oauth2/access_token'),

  // Token store
  TOKEN_STORE: z.enum(['file', 'memory', 'redis']).default('file'),
  TOKEN_STORE_FILE_PATH: z.string().default('.tokens.json'),

  // Cache
  CACHE_PROVIDER: z.enum(['memory', 'redis']).default('memory'),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().int().nonnegative().default(300),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // LLM
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'gemini', 'bedrock']).default('openai'),
  LLM_MODEL: z.string().optional(),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().url().default('https://api.anthropic.com'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com'),
  AWS_REGION: z.string().default('us-east-1'),
  BEDROCK_MODEL_ID: z.string().optional(),

  // Chunking
  MAX_FILES_PER_CHUNK: z.coerce.number().int().positive().default(50),
  MAX_DIFF_LINES_PER_CHUNK: z.coerce.number().int().positive().default(5000),

  // Rate limiting
  RATE_LIMIT_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
  RATE_LIMIT_BASE_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
  RATE_LIMIT_MAX_DELAY_MS: z.coerce.number().int().positive().default(20000),

  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OTEL_ENABLED: booleanFromString.default('false'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export type RawEnv = z.infer<typeof EnvSchema>;

export type AuthMode = 'token' | 'basic' | 'oauth';

export interface Config extends RawEnv {
  authMode: AuthMode;
}

let cached: Config | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  }

  const value = parsed.data;
  const authMode = resolveAuthMode(value);

  if (authMode === 'oauth' && (!value.BITBUCKET_CLIENT_ID || !value.BITBUCKET_CLIENT_SECRET)) {
    throw new ConfigError(
      'OAuth mode requires BITBUCKET_CLIENT_ID and BITBUCKET_CLIENT_SECRET (or set BITBUCKET_ACCESS_TOKEN for token mode).',
    );
  }

  return Object.freeze({ ...value, authMode });
}

function resolveAuthMode(value: RawEnv): AuthMode {
  if (!value.BITBUCKET_ACCESS_TOKEN) {
    return 'oauth';
  }
  const token = value.BITBUCKET_ACCESS_TOKEN;
  const hasBasicIdentity = Boolean(value.BITBUCKET_EMAIL || value.BITBUCKET_USERNAME);
  if (hasBasicIdentity || token.startsWith('ATATT')) {
    if (token.startsWith('ATATT') && !value.BITBUCKET_EMAIL && !value.BITBUCKET_USERNAME) {
      throw new ConfigError(
        'Bitbucket API tokens (ATATT…) require BITBUCKET_EMAIL (your Atlassian account email). ' +
          'See https://support.atlassian.com/bitbucket-cloud/docs/using-api-tokens/',
      );
    }
    return 'basic';
  }
  return 'token';
}

export function getConfig(): Config {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

/** Test helper: reset the cached singleton. */
export function resetConfigCache(): void {
  cached = undefined;
}
