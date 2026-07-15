import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestDiffQuery } from '../../application/use-cases/pull-request/query/diff/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'get_pull_request_diff',
  title: 'Get pull request diff',
  description: 'Returns the raw unified diff for a pull request.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    pullRequestId: z.number().int().positive().describe('Pull request id.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestDiffQuery(deps.pullRequestRepository);
    const output = await useCase.execute({ context, pullRequestId: args.pullRequestId as number });
    return jsonResult(output.data);
  },
});

export default tool;
