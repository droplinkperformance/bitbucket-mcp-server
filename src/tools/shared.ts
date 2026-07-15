import { z } from 'zod';
import type { Config } from '../infrastructure/config/env.js';
import type { BitbucketContext } from '../shared/context.js';
import type { ToolResult } from '../mcp/types.js';
import { AppError } from '../shared/errors.js';

/**
 * Common Zod fields injected into every tool's input schema. `workspace` is
 * explicit per call (multi-workspace); it may be omitted only when a default
 * workspace is configured. `repository` is included where the operation needs
 * a repo.
 */
export const workspaceField = {
  workspace: z
    .string()
    .min(1)
    .optional()
    .describe('Bitbucket workspace slug. Falls back to BITBUCKET_DEFAULT_WORKSPACE if omitted.'),
};

export const repositoryField = {
  repository: z.string().min(1).describe('Bitbucket repository slug.'),
};

export interface ResolveContextArgs {
  workspace?: string;
  repository?: string;
}

export function resolveContext(
  args: ResolveContextArgs,
  config: Config,
  opts: { requireRepository?: boolean } = {},
): BitbucketContext {
  const workspace = args.workspace ?? config.BITBUCKET_DEFAULT_WORKSPACE;
  if (!workspace) {
    throw new AppError(
      'A "workspace" is required (or configure BITBUCKET_DEFAULT_WORKSPACE).',
      { status: 400, code: 'missing_workspace' },
    );
  }
  if (opts.requireRepository && !args.repository) {
    throw new AppError('A "repository" is required for this tool.', {
      status: 400,
      code: 'missing_repository',
    });
  }
  return { workspace, repository: args.repository };
}

/** Build a standard tool result that surfaces the `data` envelope as JSON. */
export function jsonResult<T>(data: T): ToolResult {
  return {
    structuredContent: { data },
    text: JSON.stringify({ data }, null, 2),
  };
}
