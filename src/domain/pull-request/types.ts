import type { User } from '../user/types.js';

export type PullRequestState = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

export interface BranchRef {
  branch: string;
  commit?: string;
  repository?: string;
}

/** Provider-agnostic, normalized pull request. */
export interface PullRequest {
  id: number;
  title: string;
  description?: string;
  state: PullRequestState;
  author?: User;
  source: BranchRef;
  destination: BranchRef;
  createdOn?: string;
  updatedOn?: string;
  commentCount?: number;
  url?: string;
}

export interface InlineLocation {
  path: string;
  from?: number;
  to?: number;
}

export interface PullRequestComment {
  id: number;
  content: string;
  author?: User;
  createdOn?: string;
  inline?: InlineLocation;
  deleted?: boolean;
}

export type FileChangeStatus =
  | 'added'
  | 'removed'
  | 'modified'
  | 'renamed'
  | 'copied'
  | 'unknown';

export interface PullRequestFileChange {
  path: string;
  oldPath?: string;
  status: FileChangeStatus;
  linesAdded?: number;
  linesRemoved?: number;
}

export interface Commit {
  hash: string;
  message: string;
  author?: string;
  date?: string;
}
