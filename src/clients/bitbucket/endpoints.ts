import type { BitbucketContext } from '../../shared/context.js';

function repoSlug(context: BitbucketContext): string {
  if (!context.repository) {
    throw new Error('A repository is required for this Bitbucket endpoint.');
  }
  return `${encodeURIComponent(context.workspace)}/${encodeURIComponent(context.repository)}`;
}

/** Relative path builders for the Bitbucket Cloud REST API v2. */
export const endpoints = {
  currentUser(): string {
    return '/user';
  },
  workspace(workspace: string): string {
    return `/workspaces/${encodeURIComponent(workspace)}`;
  },
  repository(context: BitbucketContext): string {
    return `/repositories/${repoSlug(context)}`;
  },
  pullRequests(context: BitbucketContext): string {
    return `/repositories/${repoSlug(context)}/pullrequests`;
  },
  pullRequest(context: BitbucketContext, id: number): string {
    return `/repositories/${repoSlug(context)}/pullrequests/${id}`;
  },
  pullRequestDiff(context: BitbucketContext, id: number): string {
    return `/repositories/${repoSlug(context)}/pullrequests/${id}/diff`;
  },
  pullRequestDiffStat(context: BitbucketContext, id: number): string {
    return `/repositories/${repoSlug(context)}/pullrequests/${id}/diffstat`;
  },
  pullRequestComments(context: BitbucketContext, id: number): string {
    return `/repositories/${repoSlug(context)}/pullrequests/${id}/comments`;
  },
  pullRequestCommits(context: BitbucketContext, id: number): string {
    return `/repositories/${repoSlug(context)}/pullrequests/${id}/commits`;
  },
};
