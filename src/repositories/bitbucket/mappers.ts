import type {
  Commit,
  FileChangeStatus,
  PullRequest,
  PullRequestComment,
  PullRequestFileChange,
  PullRequestState,
} from '../../domain/pull-request/types.js';
import type { User } from '../../domain/user/types.js';
import type {
  BitbucketAccount,
  BitbucketBranchRef,
  BitbucketComment,
  BitbucketCommit,
  BitbucketDiffStat,
  BitbucketPullRequest,
} from '../../clients/bitbucket/types.js';

export function toUser(account: BitbucketAccount | undefined): User | undefined {
  if (!account) {
    return undefined;
  }
  return {
    accountId: account.account_id ?? account.uuid ?? account.nickname ?? 'unknown',
    username: account.username ?? account.nickname,
    displayName: account.display_name ?? account.nickname ?? account.username ?? 'Unknown',
    nickname: account.nickname,
    type: account.type,
  };
}

function toBranchRef(ref: BitbucketBranchRef | undefined): { branch: string; commit?: string; repository?: string } {
  return {
    branch: ref?.branch?.name ?? '',
    commit: ref?.commit?.hash,
    repository: ref?.repository?.full_name ?? ref?.repository?.name,
  };
}

function toState(state: string): PullRequestState {
  switch (state?.toUpperCase()) {
    case 'OPEN':
      return 'OPEN';
    case 'MERGED':
      return 'MERGED';
    case 'DECLINED':
      return 'DECLINED';
    case 'SUPERSEDED':
      return 'SUPERSEDED';
    default:
      return 'OPEN';
  }
}

export function toPullRequest(raw: BitbucketPullRequest): PullRequest {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    state: toState(raw.state),
    author: toUser(raw.author),
    source: toBranchRef(raw.source),
    destination: toBranchRef(raw.destination),
    createdOn: raw.created_on,
    updatedOn: raw.updated_on,
    commentCount: raw.comment_count,
    url: raw.links?.html?.href,
  };
}

export function toComment(raw: BitbucketComment): PullRequestComment {
  const inline = raw.inline
    ? {
        path: raw.inline.path,
        from: raw.inline.from ?? undefined,
        to: raw.inline.to ?? undefined,
      }
    : undefined;
  return {
    id: raw.id,
    content: raw.content?.raw ?? '',
    author: toUser(raw.user),
    createdOn: raw.created_on,
    inline,
    deleted: raw.deleted,
  };
}

function toFileStatus(status: string | undefined): FileChangeStatus {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'removed';
    case 'modified':
      return 'modified';
    case 'renamed':
      return 'renamed';
    case 'copied':
      return 'copied';
    default:
      return 'unknown';
  }
}

export function toFileChange(raw: BitbucketDiffStat): PullRequestFileChange {
  const newPath = raw.new?.path;
  const oldPath = raw.old?.path;
  return {
    path: newPath ?? oldPath ?? 'unknown',
    oldPath: oldPath && oldPath !== newPath ? oldPath : undefined,
    status: toFileStatus(raw.status),
    linesAdded: raw.lines_added,
    linesRemoved: raw.lines_removed,
  };
}

export function toCommit(raw: BitbucketCommit): Commit {
  return {
    hash: raw.hash,
    message: raw.message ?? '',
    author: raw.author?.user?.display_name ?? raw.author?.raw,
    date: raw.date,
  };
}
