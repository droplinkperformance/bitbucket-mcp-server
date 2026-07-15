import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestGetQuery } from '../../application/use-cases/pull-request/query/get/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'get_pull_request',
  title: 'Get pull request',
  description: 'Fetches a single pull request by id.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    pullRequestId: z.number().int().positive().describe('Pull request id.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestGetQuery(deps.pullRequestRepository);
    const output = await useCase.execute({ context, pullRequestId: args.pullRequestId as number });
    return jsonResult(output.data);
  },
});

export default tool;
