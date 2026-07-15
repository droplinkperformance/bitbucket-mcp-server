/**
 * Provider-agnostic LLM contract. Agents depend ONLY on this interface and must
 * never know which vendor (OpenAI/Anthropic/Gemini/Bedrock) is configured.
 *
 * `complete<T>` returns the model output already parsed into the expected shape
 * `T`. Implementations are responsible for instructing the model to return JSON
 * and for parsing/validating the response.
 */
export interface LlmProvider {
  complete<T>(prompt: string, options?: Record<string, unknown>): Promise<T>;
}

/** Strongly-typed view of the loosely-typed `options` bag accepted by `complete`. */
export interface LlmCompleteOptions {
  /** System / developer instructions. */
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Override the configured default model. */
  model?: string;
  /** When true (default), the provider asks the model for strict JSON. */
  json?: boolean;
}

export function readOptions(options?: Record<string, unknown>): LlmCompleteOptions {
  return (options ?? {}) as LlmCompleteOptions;
}
