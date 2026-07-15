export type HeaderBag = Record<string, string | string[] | number | undefined>;

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  /** Epoch milliseconds when the window resets. */
  resetAt?: number;
  /** Explicit server-provided wait before retrying, in milliseconds. */
  retryAfterMs?: number;
}

export interface RetryDecisionInput {
  attempt: number;
  status?: number;
  info?: RateLimitInfo;
  error?: unknown;
}

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
}

/**
 * Provider-agnostic rate-limit / retry policy. `BitbucketClient` depends only on
 * this interface, so a future GitHub/GitLab/Azure client can supply its own
 * header parsing and backoff rules without touching the client logic.
 */
export interface RateLimitStrategy {
  /** Extract structured rate-limit info from a response's headers. */
  parseHeaders(headers: HeaderBag): RateLimitInfo;
  /** Decide whether to retry, and how long to wait first. */
  getRetryDecision(input: RetryDecisionInput): RetryDecision;
  /** Record the latest observed quota (used for observability / pre-emptive throttling). */
  recordQuota(info: RateLimitInfo): void;
  /** Last observed quota, if any. */
  getQuota(): RateLimitInfo | undefined;
}
