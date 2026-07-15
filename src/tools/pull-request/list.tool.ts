import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestListQuery } from '../../application/use-cases/pull-request/query/list/use-case.js';
import type { PullRequestState } from '../../domain/pull-request/types.js';

const tool: ToolFactory = (deps) => ({
  name: 'list_pull_requests',
  title: 'List pull requests',
  description: 'Lists pull requests in a repository, optionally filtered by state or a query.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    state: z.enum(['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED']).optional(),
    query: z.string().optional().describe('Bitbucket query (BBQL) filter.'),
    limit: z.number().int().positive().max(500).optional().describe('Max pull requests to return.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestListQuery(deps.pullRequestRepository);
    const output = await useCase.execute({
      context,
      state: args.state as PullRequestState | undefined,
      query: args.query as string | undefined,
      limit: args.limit as number | undefined,
    });
    return jsonResult(output.data);
  },
});

export default tool;
