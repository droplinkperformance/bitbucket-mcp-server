import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestCommentCommand } from '../../application/use-cases/pull-request/command/comment/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'comment_pull_request',
  title: 'Comment on a pull request',
  description:
    'Adds a comment to a pull request. Provide `inline` to attach the comment to a file/line.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    pullRequestId: z.number().int().positive().describe('Pull request id.'),
    content: z.string().min(1).describe('Comment body (Markdown).'),
    inline: z
      .object({
        path: z.string().min(1),
        to: z.number().int().positive().optional().describe('Line number on the new side.'),
        from: z.number().int().positive().optional().describe('Line number on the old side.'),
      })
      .optional()
      .describe('Inline location to attach the comment to.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestCommentCommand(deps.pullRequestRepository);
    const output = await useCase.execute({
      context,
      pullRequestId: args.pullRequestId as number,
      content: args.content as string,
      inline: args.inline as { path: string; to?: number; from?: number } | undefined,
    });
    return jsonResult(output.data);
  },
});

export default tool;
