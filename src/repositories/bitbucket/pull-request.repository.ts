import type {
  AddCommentParams,
  CreatePullRequestParams,
  ListPullRequestsParams,
  PullRequestRepository,
  UpdatePullRequestParams,
} from '../../domain/contracts/pull-request.repository.js';
import type {
  Commit,
  PullRequest,
  PullRequestComment,
  PullRequestFileChange,
} from '../../domain/pull-request/types.js';
import type { BitbucketContext } from '../../shared/context.js';
import type { BitbucketClient } from '../../clients/bitbucket/BitbucketClient.js';
import type {
  BitbucketComment,
  BitbucketCommit,
  BitbucketDiffStat,
  BitbucketPullRequest,
} from '../../clients/bitbucket/types.js';
import { endpoints } from '../../clients/bitbucket/endpoints.js';
import { toComment, toCommit, toFileChange, toPullRequest } from './mappers.js';

const DEFAULT_LIMIT = 50;

/** Bitbucket implementation of the provider-agnostic PullRequestRepository. */
export class BitbucketPullRequestRepository implements PullRequestRepository {
  constructor(private readonly client: BitbucketClient) {}

  async list(params: ListPullRequestsParams): Promise<PullRequest[]> {
    const query: Record<string, unknown> = {};
    if (params.state) {
      query.state = params.state;
    }
    if (params.query) {
      query.q = params.query;
    }
    const raw = await this.client.getPaginated<BitbucketPullRequest>(
      endpoints.pullRequests(params.context),
      { params: query, limit: params.limit ?? DEFAULT_LIMIT },
    );
    return raw.map(toPullRequest);
  }

  async get(context: BitbucketContext, id: number): Promise<PullRequest> {
    const raw = await this.client.get<BitbucketPullRequest>(endpoints.pullRequest(context, id));
    return toPullRequest(raw);
  }

  async create(params: CreatePullRequestParams): Promise<PullRequest> {
    const body: Record<string, unknown> = {
      title: params.title,
      source: { branch: { name: params.sourceBranch } },
    };
    if (params.destinationBranch) {
      body.destination = { branch: { name: params.destinationBranch } };
    }
    if (params.description) {
      body.description = params.description;
    }
    if (params.closeSourceBranch !== undefined) {
      body.close_source_branch = params.closeSourceBranch;
    }
    if (params.reviewers && params.reviewers.length > 0) {
      body.reviewers = params.reviewers.map((id) => ({ account_id: id }));
    }
    const raw = await this.client.post<BitbucketPullRequest>(
      endpoints.pullRequests(params.context),
      body,
    );
    return toPullRequest(raw);
  }

  async update(params: UpdatePullRequestParams): Promise<PullRequest> {
    const body: Record<string, unknown> = {};
    if (params.title !== undefined) {
      body.title = params.title;
    }
    if (params.description !== undefined) {
      body.description = params.description;
    }
    const raw = await this.client.put<BitbucketPullRequest>(
      endpoints.pullRequest(params.context, params.pullRequestId),
      body,
    );
    return toPullRequest(raw);
  }

  async getDiff(context: BitbucketContext, id: number): Promise<string> {
    return this.client.getText(endpoints.pullRequestDiff(context, id));
  }

  async getFiles(context: BitbucketContext, id: number): Promise<PullRequestFileChange[]> {
    const raw = await this.client.getPaginated<BitbucketDiffStat>(
      endpoints.pullRequestDiffStat(context, id),
      { limit: 1000 },
    );
    return raw.map(toFileChange);
  }

  async getComments(context: BitbucketContext, id: number): Promise<PullRequestComment[]> {
    const raw = await this.client.getPaginated<BitbucketComment>(
      endpoints.pullRequestComments(context, id),
      { limit: 500 },
    );
    return raw.filter((comment) => !comment.deleted).map(toComment);
  }

  async addComment(params: AddCommentParams): Promise<PullRequestComment> {
    const body: Record<string, unknown> = { content: { raw: params.content } };
    if (params.inline) {
      body.inline = {
        path: params.inline.path,
        ...(params.inline.to !== undefined ? { to: params.inline.to } : {}),
        ...(params.inline.from !== undefined ? { from: params.inline.from } : {}),
      };
    }
    const raw = await this.client.post<BitbucketComment>(
      endpoints.pullRequestComments(params.context, params.pullRequestId),
      body,
    );
    return toComment(raw);
  }

  async getCommits(context: BitbucketContext, id: number): Promise<Commit[]> {
    const raw = await this.client.getPaginated<BitbucketCommit>(
      endpoints.pullRequestCommits(context, id),
      { limit: 200 },
    );
    return raw.map(toCommit);
  }
}
