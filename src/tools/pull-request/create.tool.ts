import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestCreateCommand } from '../../application/use-cases/pull-request/command/create/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'create_pull_request',
  title: 'Create pull request',
  description: 'Creates a pull request from a source branch to a destination branch.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    title: z.string().min(1).describe('Pull request title.'),
    sourceBranch: z.string().min(1).describe('Source branch name.'),
    destinationBranch: z.string().optional().describe('Destination branch (defaults to main branch).'),
    description: z.string().optional(),
    closeSourceBranch: z.boolean().optional(),
    reviewers: z.array(z.string()).optional().describe('Reviewer account ids.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestCreateCommand(deps.pullRequestRepository);
    const output = await useCase.execute({
      context,
      title: args.title as string,
      sourceBranch: args.sourceBranch as string,
      destinationBranch: args.destinationBranch as string | undefined,
      description: args.description as string | undefined,
      closeSourceBranch: args.closeSourceBranch as boolean | undefined,
      reviewers: args.reviewers as string[] | undefined,
    });
    return jsonResult(output.data);
  },
});

export default tool;
