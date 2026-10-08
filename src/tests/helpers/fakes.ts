import pino from 'pino';
import type { Logger } from '../../infrastructure/logger/pino.js';
import type { LlmProvider } from '../../llm/LlmProvider.js';
import type { UserRepository } from '../../domain/contracts/user.repository.js';
import type { PullRequestRepository } from '../../domain/contracts/pull-request.repository.js';
import type {
  Commit,
  PullRequest,
  PullRequestComment,
  PullRequestFileChange,
} from '../../domain/pull-request/types.js';
import type { User } from '../../domain/user/types.js';

export function silentLogger(): Logger {
  return pino({ level: 'silent' });
}

/** Returns a fixed object for every completion; records prompts for assertions. */
export class FakeLlmProvider implements LlmProvider {
  readonly prompts: string[] = [];

  constructor(private readonly response: unknown) {}

  async complete<T>(prompt: string): Promise<T> {
    this.prompts.push(prompt);
    return this.response as T;
  }
}

export class FakeUserRepository implements UserRepository {
  constructor(private readonly user: User) {}
  async getCurrentUser(): Promise<User> {
    return this.user;
  }
}

export interface FakePullRequestData {
  pullRequest: PullRequest;
  diff: string;
  files: PullRequestFileChange[];
  comments: PullRequestComment[];
  commits: Commit[];
}

export class FakePullRequestRepository implements PullRequestRepository {
  created: unknown[] = [];
  updated: unknown[] = [];
  addedComments: unknown[] = [];

  constructor(private readonly data: FakePullRequestData) {}

  async list(): Promise<PullRequest[]> {
    return [this.data.pullRequest];
  }
  async get(): Promise<PullRequest> {
    return this.data.pullRequest;
  }
  async create(params: unknown): Promise<PullRequest> {
    this.created.push(params);
    return this.data.pullRequest;
  }
  async update(params: unknown): Promise<PullRequest> {
    this.updated.push(params);
    return this.data.pullRequest;
  }
  async getDiff(): Promise<string> {
    return this.data.diff;
  }
  async getFiles(): Promise<PullRequestFileChange[]> {
    return this.data.files;
  }
  async getComments(): Promise<PullRequestComment[]> {
    return this.data.comments;
  }
  async addComment(params: unknown): Promise<PullRequestComment> {
    this.addedComments.push(params);
    return this.data.comments[0] ?? { id: 1, content: 'ok' };
  }
  async getCommits(): Promise<Commit[]> {
    return this.data.commits;
  }
}

export function sampleUser(): User {
  return { accountId: 'acc-1', username: 'jdoe', displayName: 'Jane Doe' };
}

export function samplePullRequestData(diff?: string): FakePullRequestData {
  return {
    pullRequest: {
      id: 42,
      title: 'Add feature',
      state: 'OPEN',
      source: { branch: 'feature' },
      destination: { branch: 'main' },
    },
    diff: diff ?? 'diff --git a/file.ts b/file.ts\n+const x = 1;\n',
    files: [{ path: 'file.ts', status: 'modified', linesAdded: 1, linesRemoved: 0 }],
    comments: [{ id: 1, content: 'looks good' }],
    commits: [{ hash: 'abcdef123456', message: 'feat: x' }],
  };
}
