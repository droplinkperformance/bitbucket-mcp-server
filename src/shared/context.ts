/**
 * Provider-agnostic request context that every tool/use-case receives explicitly.
 *
 * No part of the system assumes a single workspace; the caller must supply the
 * workspace (and optionally a repository) on each invocation. This is what
 * enables multi-workspace, multi-user and future SaaS deployments.
 */
export interface BitbucketContext {
  workspace: string;
  repository?: string;
}

export function requireRepository(context: BitbucketContext): string {
  if (!context.repository) {
    throw new Error('This operation requires a "repository" in the context.');
  }
  return context.repository;
}
