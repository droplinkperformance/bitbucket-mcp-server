import type { LlmProvider } from './LlmProvider.js';
import { readOptions } from './LlmProvider.js';
import { parseJsonFromText } from './json.js';
import { ConfigError, LlmError } from '../shared/errors.js';

export interface BedrockProviderOptions {
  region: string;
  modelId?: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
}

interface BedrockRuntimeLike {
  send(command: unknown): Promise<{ body: Uint8Array }>;
}

/**
 * AWS Bedrock implementation (Anthropic Claude message format on Bedrock).
 *
 * `@aws-sdk/client-bedrock-runtime` is NOT a hard dependency; it is imported
 * lazily so the rest of the server runs without the AWS SDK unless
 * LLM_PROVIDER=bedrock is selected.
 */
export class BedrockProvider implements LlmProvider {
  private clientPromise: Promise<{ client: BedrockRuntimeLike; InvokeModelCommand: new (input: unknown) => unknown }> | undefined;

  constructor(private readonly options: BedrockProviderOptions) {}

  private async getRuntime() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        try {
          // Indirect specifier keeps this an OPTIONAL dependency: the AWS SDK is
          // not installed by default and must not be resolved at build time.
          const moduleName = '@aws-sdk/client-bedrock-runtime';
          const mod = (await import(moduleName)) as unknown as {
            BedrockRuntimeClient: new (config: { region: string }) => BedrockRuntimeLike;
            InvokeModelCommand: new (input: unknown) => unknown;
          };
          return {
            client: new mod.BedrockRuntimeClient({ region: this.options.region }),
            InvokeModelCommand: mod.InvokeModelCommand,
          };
        } catch (error) {
          throw new ConfigError(
            'LLM_PROVIDER=bedrock requires the optional "@aws-sdk/client-bedrock-runtime" dependency to be installed.',
            error instanceof Error ? error.message : error,
          );
        }
      })();
    }
    return this.clientPromise;
  }

  async complete<T>(prompt: string, options?: Record<string, unknown>): Promise<T> {
    const opts = readOptions(options);
    const modelId = opts.model ?? this.options.modelId;
    if (!modelId) {
      throw new ConfigError('BEDROCK_MODEL_ID (or options.model) is required for the Bedrock provider.');
    }
    const wantsJson = opts.json !== false;

    const system = [opts.system, wantsJson ? 'Respond with valid JSON only, no prose.' : undefined]
      .filter(Boolean)
      .join('\n\n');

    const { client, InvokeModelCommand } = await this.getRuntime();

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: opts.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
      temperature: opts.temperature ?? this.options.defaultTemperature,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    };

    try {
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
      });
      const response = await client.send(command);
      const decoded = JSON.parse(new TextDecoder().decode(response.body));
      const blocks: Array<{ type: string; text?: string }> = decoded?.content ?? [];
      const text = blocks
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('');
      if (!text) {
        throw new LlmError('Bedrock returned an empty completion.');
      }
      return wantsJson ? parseJsonFromText<T>(text) : (text as unknown as T);
    } catch (error) {
      if (error instanceof LlmError || error instanceof ConfigError) {
        throw error;
      }
      throw new LlmError('Bedrock completion failed.', error instanceof Error ? error.message : error);
    }
  }
}
