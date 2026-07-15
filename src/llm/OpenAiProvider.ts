import axios, { type AxiosInstance } from 'axios';
import type { LlmProvider } from './LlmProvider.js';
import { readOptions } from './LlmProvider.js';
import { parseJsonFromText } from './json.js';
import { LlmError } from '../shared/errors.js';

export interface OpenAiProviderOptions {
  apiKey: string;
  baseUrl: string;
  defaultModel?: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
  http?: AxiosInstance;
}

/** OpenAI Chat Completions implementation. Vendor specifics live only here. */
export class OpenAiProvider implements LlmProvider {
  private readonly http: AxiosInstance;

  constructor(private readonly options: OpenAiProviderOptions) {
    this.http =
      options.http ??
      axios.create({
        baseURL: options.baseUrl,
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 120_000,
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
      const response = await this.http.post('/chat/completions', {
        model,
        temperature: opts.temperature ?? this.options.defaultTemperature,
        max_tokens: opts.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
        ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
        messages,
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
  if (axios.isAxiosError(error)) {
    return { status: error.response?.status, data: error.response?.data };
  }
  return error instanceof Error ? error.message : error;
}
