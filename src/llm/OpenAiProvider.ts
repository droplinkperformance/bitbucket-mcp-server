import type { LlmProvider } from './LlmProvider.js';
import { readOptions } from './LlmProvider.js';
import { parseJsonFromText } from './json.js';
import { LlmError } from '../shared/errors.js';
import { createHttpClient, isHttpError, type HttpClient } from '../infrastructure/http/client.js';

export interface OpenAiProviderOptions {
  apiKey: string;
  baseUrl: string;
  defaultModel?: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
  http?: HttpClient;
}

/** OpenAI Chat Completions implementation. Vendor specifics live only here. */
export class OpenAiProvider implements LlmProvider {
  private readonly http: HttpClient;

  constructor(private readonly options: OpenAiProviderOptions) {
    this.http =
      options.http ??
      createHttpClient({
        baseUrl: options.baseUrl,
        timeoutMs: 120_000,
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      });
  }

  async complete<T>(prompt: string, options?: Record<string, unknown>): Promise<T> {
    const opts = readOptions(options);
    const model = opts.model ?? this.options.defaultModel ?? 'gpt-4o';
    const wantsJson = opts.json !== false;

    const messages: Array<{ role: string; content: string }> = [];
    if (opts.system) {
      messages.push({ role: 'system', content: opts.system });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await this.http.request<{
        choices?: Array<{ message?: { content?: string } }>;
      }>({
        method: 'POST',
        url: '/chat/completions',
        body: {
          model,
          temperature: opts.temperature ?? this.options.defaultTemperature,
          max_tokens: opts.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
          ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
          messages,
        },
      });

      const content: string | undefined = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new LlmError('OpenAI returned an empty completion.');
      }
      return wantsJson ? parseJsonFromText<T>(content) : (content as unknown as T);
    } catch (error) {
      if (error instanceof LlmError) {
        throw error;
      }
      throw new LlmError('OpenAI completion failed.', extractDetails(error));
    }
  }
}

function extractDetails(error: unknown): unknown {
  if (isHttpError(error)) {
    return { status: error.status, data: error.data };
  }
  return error instanceof Error ? error.message : error;
}
