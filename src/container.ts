import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getConfig, type Config } from './infrastructure/config/env.js';
import { createLogger, type Logger } from './infrastructure/logger/pino.js';

import type { CacheProvider } from './cache/CacheProvider.js';
import { MemoryCacheProvider } from './cache/MemoryCacheProvider.js';
import { RedisCacheProvider } from './cache/RedisCacheProvider.js';

import type { TokenStore } from './auth/token-store/TokenStore.js';
import { FileTokenStore } from './auth/token-store/FileTokenStore.js';
import { MemoryTokenStore } from './auth/token-store/MemoryTokenStore.js';
import { RedisTokenStore } from './auth/token-store/RedisTokenStore.js';

import type { AuthProvider } from './auth/AuthProvider.js';
import { TokenProvider } from './auth/TokenProvider.js';
import { BasicAuthProvider } from './auth/BasicAuthProvider.js';
import { OAuthProvider } from './auth/OAuthProvider.js';
import { OAuthService } from './auth/OAuthService.js';

import { BitbucketRateLimitStrategy } from './ratelimit/BitbucketRateLimitStrategy.js';
import { BitbucketClient } from './clients/bitbucket/BitbucketClient.js';
import { BitbucketUserRepository } from './repositories/bitbucket/user.repository.js';
import { BitbucketPullRequestRepository } from './repositories/bitbucket/pull-request.repository.js';

import type { LlmProvider } from './llm/LlmProvider.js';
import { OpenAiProvider } from './llm/OpenAiProvider.js';
import { AnthropicProvider } from './llm/AnthropicProvider.js';
import { GeminiProvider } from './llm/GeminiProvider.js';
import { BedrockProvider } from './llm/BedrockProvider.js';

import { InMemoryEventBus } from './events/InMemoryEventBus.js';
import { PullRequestChunkingService } from './services/chunking/PullRequestChunkingService.js';
import { CodeReviewAgent } from './agents/code-review.agent.js';

import type { AppDependencies } from './app-dependencies.js';
import { createMcpServer } from './mcp/server.js';
import { ConfigError } from './shared/errors.js';

export interface Container {
  config: Config;
  logger: Logger;
  deps: AppDependencies;
  createServer: () => Promise<McpServer>;
  shutdown: () => Promise<void>;
}

/**
 * Composition root. This is the ONLY module that references concrete
 * implementations of the provider-agnostic abstractions (AuthProvider,
 * CacheProvider, TokenStore, RateLimitStrategy, LlmProvider, EventBus). Wiring
 * is chosen from configuration so providers swap without touching business
 * logic.
 */
export async function buildContainer(configInput?: Config): Promise<Container> {
  const config = configInput ?? getConfig();
  const logger = createLogger({ level: config.LOG_LEVEL });

  const cache = buildCache(config);
  const authProvider = buildAuthProvider(config);
  const rateLimit = new BitbucketRateLimitStrategy({
    maxRetries: config.RATE_LIMIT_MAX_RETRIES,
    baseDelayMs: config.RATE_LIMIT_BASE_DELAY_MS,
    maxDelayMs: config.RATE_LIMIT_MAX_DELAY_MS,
  });

  const client = new BitbucketClient({
    baseUrl: config.BITBUCKET_API_BASE_URL,
    authProvider,
    rateLimit,
    cache,
    logger,
  });

  const userRepository = new BitbucketUserRepository(client, config.CACHE_DEFAULT_TTL_SECONDS);
  const pullRequestRepository = new BitbucketPullRequestRepository(client);

  const llm = buildLlm(config, logger);
  const eventBus = new InMemoryEventBus({
    onError: (error, event) =>
      logger.error({ event: event.name, err: error instanceof Error ? error.message : error }, 'Event handler failed'),
  });

  const chunking = new PullRequestChunkingService({
    maxFilesPerChunk: config.MAX_FILES_PER_CHUNK,
    maxDiffLinesPerChunk: config.MAX_DIFF_LINES_PER_CHUNK,
  });

  const codeReviewAgent = new CodeReviewAgent({
    pullRequests: pullRequestRepository,
    llm,
    chunking,
    eventBus,
    logger,
  });

  const deps: AppDependencies = {
    config,
    logger,
    userRepository,
    pullRequestRepository,
    codeReviewAgent,
    eventBus,
  };

  return {
    config,
    logger,
    deps,
    createServer: () => createMcpServer(deps),
    shutdown: async () => {
      if (cache instanceof RedisCacheProvider) {
        await cache.close();
      }
    },
  };
}

function buildCache(config: Config): CacheProvider {
  if (config.CACHE_PROVIDER === 'redis') {
    return new RedisCacheProvider({
      url: config.REDIS_URL,
      defaultTtlSeconds: config.CACHE_DEFAULT_TTL_SECONDS,
      keyPrefix: 'bb:cache:',
    });
  }
  return new MemoryCacheProvider({ defaultTtlSeconds: config.CACHE_DEFAULT_TTL_SECONDS });
}

function buildTokenStore(config: Config): TokenStore {
  switch (config.TOKEN_STORE) {
    case 'memory':
      return new MemoryTokenStore();
    case 'redis':
      return new RedisTokenStore({ url: config.REDIS_URL });
    case 'file':
    default:
      return new FileTokenStore({ filePath: config.TOKEN_STORE_FILE_PATH });
  }
}

function buildAuthProvider(config: Config): AuthProvider {
  if (config.authMode === 'basic') {
    const username = config.BITBUCKET_EMAIL ?? config.BITBUCKET_USERNAME ?? '';
    return new BasicAuthProvider(username, config.BITBUCKET_ACCESS_TOKEN as string);
  }

  if (config.authMode === 'token') {
    return new TokenProvider(config.BITBUCKET_ACCESS_TOKEN as string);
  }

  const service = new OAuthService({
    clientId: config.BITBUCKET_CLIENT_ID as string,
    clientSecret: config.BITBUCKET_CLIENT_SECRET as string,
    authorizeUrl: config.BITBUCKET_AUTHORIZE_URL,
    tokenUrl: config.BITBUCKET_TOKEN_URL,
    redirectUri: config.BITBUCKET_OAUTH_REDIRECT_URI,
  });

  return new OAuthProvider({
    service,
    store: buildTokenStore(config),
    initialRefreshToken: config.BITBUCKET_REFRESH_TOKEN,
  });
}

function buildLlm(config: Config, logger: Logger): LlmProvider {
  const common = {
    defaultModel: config.LLM_MODEL,
    defaultTemperature: config.LLM_TEMPERATURE,
    defaultMaxOutputTokens: config.LLM_MAX_OUTPUT_TOKENS,
  };

  const warnMissingKey = (key: string) => {
    logger.warn(
      `LLM_PROVIDER=${config.LLM_PROVIDER} selected but ${key} is not set; analyze_pull_request will fail until it is configured.`,
    );
  };

  switch (config.LLM_PROVIDER) {
    case 'anthropic':
      if (!config.ANTHROPIC_API_KEY) warnMissingKey('ANTHROPIC_API_KEY');
      return new AnthropicProvider({
        apiKey: config.ANTHROPIC_API_KEY ?? '',
        baseUrl: config.ANTHROPIC_BASE_URL,
        ...common,
      });
    case 'gemini':
      if (!config.GEMINI_API_KEY) warnMissingKey('GEMINI_API_KEY');
      return new GeminiProvider({
        apiKey: config.GEMINI_API_KEY ?? '',
        baseUrl: config.GEMINI_BASE_URL,
        ...common,
      });
    case 'bedrock':
      if (!config.BEDROCK_MODEL_ID) warnMissingKey('BEDROCK_MODEL_ID');
      return new BedrockProvider({
        region: config.AWS_REGION,
        modelId: config.BEDROCK_MODEL_ID,
        defaultTemperature: config.LLM_TEMPERATURE,
        defaultMaxOutputTokens: config.LLM_MAX_OUTPUT_TOKENS,
      });
    case 'openai':
      if (!config.OPENAI_API_KEY) warnMissingKey('OPENAI_API_KEY');
      return new OpenAiProvider({
        apiKey: config.OPENAI_API_KEY ?? '',
        baseUrl: config.OPENAI_BASE_URL,
        ...common,
      });
    default:
      throw new ConfigError(`Unknown LLM_PROVIDER: ${config.LLM_PROVIDER}`);
  }
}
