import { describe, it, expect } from 'vitest';
import { BitbucketRateLimitStrategy } from '../ratelimit/BitbucketRateLimitStrategy.js';

function strategy(overrides: Partial<ConstructorParameters<typeof BitbucketRateLimitStrategy>[0]> = {}) {
  return new BitbucketRateLimitStrategy({
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 10_000,
    random: () => 0.5,
    ...overrides,
  });
}

describe('BitbucketRateLimitStrategy', () => {
  it('parses Retry-After seconds into ms', () => {
    const info = strategy().parseHeaders({ 'retry-after': '2' });
    expect(info.retryAfterMs).toBe(2000);
  });

  it('parses X-RateLimit headers', () => {
    const info = strategy().parseHeaders({
      'x-ratelimit-limit': '1000',
      'x-ratelimit-remaining': '5',
      'x-ratelimit-reset': '1700',
    });
    expect(info.limit).toBe(1000);
    expect(info.remaining).toBe(5);
    expect(info.resetAt).toBe(1700 * 1000);
  });

  it('retries on 429 and honors Retry-After', () => {
    const decision = strategy().getRetryDecision({
      attempt: 0,
      status: 429,
      info: { retryAfterMs: 1500 },
    });
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBe(1500);
  });

  it('applies exponential backoff with jitter when no Retry-After', () => {
    const decision = strategy().getRetryDecision({ attempt: 2, status: 503 });
    // base 100 * 2^2 = 400, jitter floor(0.5*400) = 200
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBe(200);
  });

  it('does not retry non-retryable statuses', () => {
    expect(strategy().getRetryDecision({ attempt: 0, status: 404 }).shouldRetry).toBe(false);
  });

  it('stops retrying after maxRetries', () => {
    expect(strategy().getRetryDecision({ attempt: 3, status: 500 }).shouldRetry).toBe(false);
  });

  it('caps delay at maxDelayMs', () => {
    const decision = strategy({ baseDelayMs: 100, maxDelayMs: 250, random: () => 1 }).getRetryDecision({
      attempt: 5,
      status: 500,
    });
    expect(decision.delayMs).toBeLessThanOrEqual(250);
  });

  it('records and exposes quota', () => {
    const s = strategy();
    s.recordQuota({ limit: 100, remaining: 10 });
    expect(s.getQuota()).toMatchObject({ limit: 100, remaining: 10 });
  });
});
