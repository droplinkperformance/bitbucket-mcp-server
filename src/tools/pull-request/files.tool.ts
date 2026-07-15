import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestFilesQuery } from '../../application/use-cases/pull-request/query/files/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'get_pull_request_files',
  title: 'Get pull request files',
  description: 'Lists the files changed by a pull request with add/remove line stats.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    pullRequestId: z.number().int().positive().describe('Pull request id.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestFilesQuery(deps.pullRequestRepository);
    const output = await useCase.execute({ context, pullRequestId: args.pullRequestId as number });
    return jsonResult(output.data);
  },
});

export default tool;
