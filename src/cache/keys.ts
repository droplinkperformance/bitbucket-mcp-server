import type { BitbucketContext } from '../shared/context.js';

const NS = 'bb';

function part(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Centralized cache-key builders so cached resources (users, repos, workspaces,
 * branches) have a consistent, collision-free namespace.
 */
export const cacheKeys = {
  currentUser(): string {
    return `${NS}:user:current`;
  },
  workspace(workspace: string): string {
    return `${NS}:workspace:${part(workspace)}`;
  },
  repository(ctx: BitbucketContext): string {
    return `${NS}:repo:${part(ctx.workspace)}:${part(ctx.repository ?? '')}`;
  },
  branch(ctx: BitbucketContext, branch: string): string {
    return `${NS}:branch:${part(ctx.workspace)}:${part(ctx.repository ?? '')}:${part(branch)}`;
  },
  raw(...segments: string[]): string {
    return `${NS}:${segments.map(part).join(':')}`;
  },
};
