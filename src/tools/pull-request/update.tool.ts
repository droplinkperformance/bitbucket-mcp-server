import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestUpdateCommand } from '../../application/use-cases/pull-request/command/update/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'update_pull_request',
  title: 'Update pull request',
  description:
    'Updates an open pull request title and/or description. At least one of title or description must be provided. Pass an empty description to clear it.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    pullRequestId: z.number().int().positive().describe('Pull request id.'),
    title: z.string().min(1).optional().describe('New pull request title.'),
    description: z
      .string()
      .optional()
      .describe('New pull request description. Pass an empty string to clear it.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestUpdateCommand(deps.pullRequestRepository);
    const output = await useCase.execute({
      context,
      pullRequestId: args.pullRequestId as number,
      title: args.title as string | undefined,
      description: args.description as string | undefined,
    });
    return jsonResult(output.data);
  },
});

export default tool;
