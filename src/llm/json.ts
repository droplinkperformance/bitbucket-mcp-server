import { LlmError } from '../shared/errors.js';

/**
 * Best-effort extraction of a JSON value from a model's text response.
 * Handles plain JSON, ```json fenced blocks, and leading/trailing prose.
 */
export function parseJsonFromText<T>(text: string): T {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Fall back to slicing the outermost JSON object/array.
    const start = candidate.search(/[{[]/);
    const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
    if (start !== -1 && end !== -1 && end > start) {
      const sliced = candidate.slice(start, end + 1);
      try {
        return JSON.parse(sliced) as T;
      } catch {
        // ignore and throw below
      }
    }
    throw new LlmError('LLM did not return parseable JSON.', {
      preview: candidate.slice(0, 200),
    });
  }
}
