import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../mcp/tool-registry.js';
import { loadConfig } from '../infrastructure/config/env.js';
import type { AppDependencies } from '../app-dependencies.js';
import type { Agent } from '../agents/agent.contract.js';
import type {
  CodeReviewAgentInput,
  CodeReviewAgentOutput,
} from '../agents/code-review.agent.js';
import { InMemoryEventBus } from '../events/InMemoryEventBus.js';
import { emptyReviewResult } from '../domain/review/ReviewResult.js';
import {
  FakePullRequestRepository,
  FakeUserRepository,
  samplePullRequestData,
  sampleUser,
  silentLogger,
} from './helpers/fakes.js';

class FakeReviewAgent implements Agent<CodeReviewAgentInput, CodeReviewAgentOutput> {
  async execute(): Promise<CodeReviewAgentOutput> {
    return { ...emptyReviewResult(), summary: 'fake review', score: 75 };
  }
}

function buildDeps(): AppDependencies {
  const config = loadConfig({
    BITBUCKET_ACCESS_TOKEN: 'token',
    BITBUCKET_DEFAULT_WORKSPACE: 'ws',
  } as NodeJS.ProcessEnv);
  return {
    config,
    logger: silentLogger(),
    userRepository: new FakeUserRepository(sampleUser()),
    pullRequestRepository: new FakePullRequestRepository(samplePullRequestData()),
    codeReviewAgent: new FakeReviewAgent(),
    eventBus: new InMemoryEventBus(),
  };
}

describe('ToolRegistry + tools', () => {
  it('auto-discovers all Phase 1 tools', async () => {
    const registry = new ToolRegistry(buildDeps());
    const modules = await registry.discover();
    const names = modules.map((m) => m.name).sort();
    expect(names).toEqual(
      [
        'analyze_pull_request',
        'comment_pull_request',
        'create_pull_request',
        'get_current_user',
        'get_pull_request',
        'get_pull_request_comments',
        'get_pull_request_diff',
        'get_pull_request_files',
        'list_pull_requests',
      ].sort(),
    );
  });

  it('get_current_user returns the data envelope', async () => {
    const registry = new ToolRegistry(buildDeps());
    const modules = await registry.discover();
    const tool = modules.find((m) => m.name === 'get_current_user')!;
    const result = await tool.handler({});
    expect(result.structuredContent).toEqual({ data: sampleUser() });
  });

  it('list_pull_requests resolves the default workspace and returns data', async () => {
    const registry = new ToolRegistry(buildDeps());
    const modules = await registry.discover();
    const tool = modules.find((m) => m.name === 'list_pull_requests')!;
    const result = await tool.handler({ repository: 'repo' });
    const payload = result.structuredContent as { data: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);
  });

  it('analyze_pull_request returns a ReviewResult via the agent', async () => {
    const registry = new ToolRegistry(buildDeps());
    const modules = await registry.discover();
    const tool = modules.find((m) => m.name === 'analyze_pull_request')!;
    const result = await tool.handler({ repository: 'repo', pullRequestId: 42 });
    const payload = result.structuredContent as { data: { summary: string; score: number } };
    expect(payload.data.summary).toBe('fake review');
    expect(payload.data.score).toBe(75);
  });

  it('requires a repository where applicable', async () => {
    const registry = new ToolRegistry(buildDeps());
    const modules = await registry.discover();
    const tool = modules.find((m) => m.name === 'get_pull_request')!;
    await expect(tool.handler({ pullRequestId: 1 })).rejects.toThrow(/repository/i);
  });
});
