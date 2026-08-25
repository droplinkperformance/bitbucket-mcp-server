import type { LlmProvider } from './LlmProvider.js';
import { readOptions } from './LlmProvider.js';
import { parseJsonFromText } from './json.js';
import { LlmError } from '../shared/errors.js';
import { createHttpClient, isHttpError, type HttpClient } from '../infrastructure/http/client.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  baseUrl: string;
  defaultModel?: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
  http?: HttpClient;
}

/** Anthropic Messages API implementation. Vendor specifics live only here. */
export class AnthropicProvider implements LlmProvider {
  private readonly http: HttpClient;

  constructor(private readonly options: AnthropicProviderOptions) {
    this.http =
      options.http ??
      createHttpClient({
        baseUrl: options.baseUrl,
        timeoutMs: 120_000,
        headers: {
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });
  }

  async complete<T>(prompt: string, options?: Record<string, unknown>): Promise<T> {
    const opts = readOptions(options);
    const model = opts.model ?? this.options.defaultModel ?? 'claude-3-5-sonnet-latest';
    const wantsJson = opts.json !== false;

    const system = [opts.system, wantsJson ? 'Respond with valid JSON only, no prose.' : undefined]
      .filter(Boolean)
      .join('\n\n');

    try {
      const response = await this.http.request<{
        content?: Array<{ type: string; text?: string }>;
      }>({
        method: 'POST',
        url: '/v1/messages',
        body: {
          model,
          max_tokens: opts.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
          temperature: opts.temperature ?? this.options.defaultTemperature,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: prompt }],
        },
      });

      const blocks: Array<{ type: string; text?: string }> = response.data?.content ?? [];
      const text = blocks
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('');
      if (!text) {
        throw new LlmError('Anthropic returned an empty completion.');
      }
      return wantsJson ? parseJsonFromText<T>(text) : (text as unknown as T);
    } catch (error) {
      if (error instanceof LlmError) {
        throw error;
      }
      throw new LlmError('Anthropic completion failed.', extractDetails(error));
    }
  }
}

function extractDetails(error: unknown): unknown {
  if (isHttpError(error)) {
    return { status: error.status, data: error.data };
  }
  return error instanceof Error ? error.message : error;
}
