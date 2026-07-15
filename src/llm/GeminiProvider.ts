import axios, { type AxiosInstance } from 'axios';
import type { LlmProvider } from './LlmProvider.js';
import { readOptions } from './LlmProvider.js';
import { parseJsonFromText } from './json.js';
import { LlmError } from '../shared/errors.js';

export interface GeminiProviderOptions {
  apiKey: string;
  baseUrl: string;
  defaultModel?: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
  http?: AxiosInstance;
}

/** Google Gemini generateContent implementation. Vendor specifics live only here. */
export class GeminiProvider implements LlmProvider {
  private readonly http: AxiosInstance;

  constructor(private readonly options: GeminiProviderOptions) {
    this.http =
      options.http ??
      axios.create({ baseURL: options.baseUrl, timeout: 120_000 });
  }

  async complete<T>(prompt: string, options?: Record<string, unknown>): Promise<T> {
    const opts = readOptions(options);
    const model = opts.model ?? this.options.defaultModel ?? 'gemini-1.5-pro';
    const wantsJson = opts.json !== false;

    try {
      const response = await this.http.post(
        `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          ...(opts.system
            ? { systemInstruction: { parts: [{ text: opts.system }] } }
            : {}),
          generationConfig: {
            temperature: opts.temperature ?? this.options.defaultTemperature,
            maxOutputTokens: opts.maxOutputTokens ?? this.options.defaultMaxOutputTokens,
            ...(wantsJson ? { responseMimeType: 'application/json' } : {}),
          },
        },
        { params: { key: this.options.apiKey } },
      );

      const parts: Array<{ text?: string }> =
        response.data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p.text ?? '').join('');
      if (!text) {
        throw new LlmError('Gemini returned an empty completion.');
      }
      return wantsJson ? parseJsonFromText<T>(text) : (text as unknown as T);
    } catch (error) {
      if (error instanceof LlmError) {
        throw error;
      }
      throw new LlmError('Gemini completion failed.', extractDetails(error));
    }
  }
}

function extractDetails(error: unknown): unknown {
  if (axios.isAxiosError(error)) {
    return { status: error.response?.status, data: error.response?.data };
  }
  return error instanceof Error ? error.message : error;
}
