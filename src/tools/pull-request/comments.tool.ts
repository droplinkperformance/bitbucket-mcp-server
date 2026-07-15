import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestCommentsQuery } from '../../application/use-cases/pull-request/query/comments/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'get_pull_request_comments',
  title: 'Get pull request comments',
  description: 'Lists the (non-deleted) comments on a pull request.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    pullRequestId: z.number().int().positive().describe('Pull request id.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestCommentsQuery(deps.pullRequestRepository);
    const output = await useCase.execute({ context, pullRequestId: args.pullRequestId as number });
    return jsonResult(output.data);
  },
});

export default tool;
