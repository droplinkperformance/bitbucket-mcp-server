import { describe, it, expect, vi } from 'vitest';
import { CodeReviewAgent } from '../agents/code-review.agent.js';
import { PullRequestChunkingService } from '../services/chunking/PullRequestChunkingService.js';
import { InMemoryEventBus } from '../events/InMemoryEventBus.js';
import {
  FakeLlmProvider,
  FakePullRequestRepository,
  samplePullRequestData,
  silentLogger,
} from './helpers/fakes.js';

const LLM_RESPONSE = {
  summary: 'Looks fine',
  risks: ['r1'],
  bugs: [],
  security: ['s1'],
  score: 80,
};

describe('CodeReviewAgent', () => {
  it('returns a normalized ReviewResult and publishes ReviewCompletedEvent', async () => {
    const repo = new FakePullRequestRepository(samplePullRequestData());
    const llm = new FakeLlmProvider(LLM_RESPONSE);
    const eventBus = new InMemoryEventBus();
    const handler = vi.fn();
    eventBus.subscribe('ReviewCompletedEvent', handler);

    const agent = new CodeReviewAgent({
      pullRequests: repo,
      llm,
      chunking: new PullRequestChunkingService({ maxFilesPerChunk: 50, maxDiffLinesPerChunk: 5000 }),
      eventBus,
      logger: silentLogger(),
    });

    const result = await agent.execute({ context: { workspace: 'w', repository: 'r' }, pullRequestId: 42 });

    expect(result).toMatchObject({
      summary: 'Looks fine',
      risks: ['r1'],
      security: ['s1'],
      score: 80,
    });
    // Defaulted arrays present.
    expect(result.performance).toEqual([]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toMatchObject({
      name: 'ReviewCompletedEvent',
      payload: { pullRequestId: 42, score: 80 },
    });
  });

  it('chunks a large PR and merges per-chunk reviews', async () => {
    const bigDiff = ['a', 'b', 'c']
      .map((p) => `diff --git a/${p}.ts b/${p}.ts\n${Array.from({ length: 8 }, (_, i) => `+l${i}`).join('\n')}`)
      .join('\n');
    const data = samplePullRequestData(bigDiff);
    data.files = [
      { path: 'a.ts', status: 'modified' },
      { path: 'b.ts', status: 'modified' },
      { path: 'c.ts', status: 'modified' },
    ];

    const repo = new FakePullRequestRepository(data);
    const llm = new FakeLlmProvider(LLM_RESPONSE);
    const agent = new CodeReviewAgent({
      pullRequests: repo,
      llm,
      chunking: new PullRequestChunkingService({ maxFilesPerChunk: 1, maxDiffLinesPerChunk: 5 }),
      eventBus: new InMemoryEventBus(),
      logger: silentLogger(),
    });

    const result = await agent.execute({ context: { workspace: 'w', repository: 'r' }, pullRequestId: 42 });

    // One LLM call per chunk (>1), merged into a single result.
    expect(llm.prompts.length).toBeGreaterThan(1);
    expect(result.score).toBe(80);
    expect(result.risks).toEqual(['r1']); // de-duplicated across chunks
  });
});
