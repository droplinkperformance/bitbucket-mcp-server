import { z } from 'zod';

/**
 * Standard, provider-independent review result. Every review agent returns this
 * shape and every review-consuming tool reads this shape, so output is
 * consistent regardless of which LLM (OpenAI/Anthropic/Gemini/Bedrock) produced
 * it.
 */
export interface ReviewResult {
  summary: string;
  architectureImpact: string[];
  risks: string[];
  bugs: string[];
  performance: string[];
  security: string[];
  observability: string[];
  breakingChanges: string[];
  recommendations: string[];
  score: number;
}

const stringArray = z.array(z.string()).default([]);

/** Zod schema used to validate/normalize raw LLM output into a ReviewResult. */
export const ReviewResultSchema = z.object({
  summary: z.string().default(''),
  architectureImpact: stringArray,
  risks: stringArray,
  bugs: stringArray,
  performance: stringArray,
  security: stringArray,
  observability: stringArray,
  breakingChanges: stringArray,
  recommendations: stringArray,
  score: z.coerce.number().min(0).max(100).default(0),
});

export const REVIEW_RESULT_KEYS = [
  'architectureImpact',
  'risks',
  'bugs',
  'performance',
  'security',
  'observability',
  'breakingChanges',
  'recommendations',
] as const;

export function emptyReviewResult(): ReviewResult {
  return {
    summary: '',
    architectureImpact: [],
    risks: [],
    bugs: [],
    performance: [],
    security: [],
    observability: [],
    breakingChanges: [],
    recommendations: [],
    score: 0,
  };
}

/** Parse/normalize unknown LLM output into a valid ReviewResult. */
export function parseReviewResult(raw: unknown): ReviewResult {
  return ReviewResultSchema.parse(raw);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

/**
 * Aggregate per-chunk reviews into a single result: list fields are merged and
 * de-duplicated, summaries are concatenated, and the score is averaged.
 */
export function mergeReviewResults(parts: ReviewResult[]): ReviewResult {
  if (parts.length === 0) {
    return emptyReviewResult();
  }
  if (parts.length === 1) {
    return parts[0]!;
  }

  const merged = emptyReviewResult();
  for (const key of REVIEW_RESULT_KEYS) {
    merged[key] = dedupe(parts.flatMap((p) => p[key]));
  }
  merged.summary = parts
    .map((p, i) => (p.summary ? `Chunk ${i + 1}: ${p.summary}` : ''))
    .filter(Boolean)
    .join('\n');
  merged.score = Math.round(parts.reduce((sum, p) => sum + (p.score || 0), 0) / parts.length);
  return merged;
}
