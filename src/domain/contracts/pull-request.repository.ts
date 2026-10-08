import type { BitbucketContext } from '../../shared/context.js';
import type {
  Commit,
  InlineLocation,
  PullRequest,
  PullRequestComment,
  PullRequestFileChange,
  PullRequestState,
} from '../pull-request/types.js';

export interface ListPullRequestsParams {
  context: BitbucketContext;
  state?: PullRequestState;
  query?: string;
  /** Max number of pull requests to return (auto-paginated up to this). */
  limit?: number;
}

export interface CreatePullRequestParams {
  context: BitbucketContext;
  title: string;
  sourceBranch: string;
  destinationBranch?: string;
  description?: string;
  closeSourceBranch?: boolean;
  reviewers?: string[];
}

export interface UpdatePullRequestParams {
  context: BitbucketContext;
  pullRequestId: number;
  /** When set, replaces the PR title. Must be non-empty. */
  title?: string;
  /**
   * When set, replaces the PR description.
   * Pass an empty string to clear the description.
   */
  description?: string;
}

export interface AddCommentParams {
  context: BitbucketContext;
  pullRequestId: number;
  content: string;
  inline?: InlineLocation;
}

/**
 * Provider-agnostic pull request repository contract. The Bitbucket
 * implementation lives in `repositories/bitbucket/pull-request.repository.ts`.
 * Adding GitHub/GitLab/Azure means adding a sibling implementation only.
 */
export interface PullRequestRepository {
  list(params: ListPullRequestsParams): Promise<PullRequest[]>;
  get(context: BitbucketContext, id: number): Promise<PullRequest>;
  create(params: CreatePullRequestParams): Promise<PullRequest>;
  update(params: UpdatePullRequestParams): Promise<PullRequest>;
  getDiff(context: BitbucketContext, id: number): Promise<string>;
  getFiles(context: BitbucketContext, id: number): Promise<PullRequestFileChange[]>;
  getComments(context: BitbucketContext, id: number): Promise<PullRequestComment[]>;
  addComment(params: AddCommentParams): Promise<PullRequestComment>;
  getCommits(context: BitbucketContext, id: number): Promise<Commit[]>;
}
