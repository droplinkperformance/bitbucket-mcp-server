import { z } from 'zod';
import type { ToolFactory } from '../../mcp/types.js';
import { jsonResult, repositoryField, resolveContext, workspaceField } from '../shared.js';
import { PullRequestAnalyzeQuery } from '../../application/use-cases/pull-request/query/analyze/use-case.js';

const tool: ToolFactory = (deps) => ({
  name: 'analyze_pull_request',
  title: 'Analyze pull request (AI review)',
  description:
    'Runs an AI code review of a pull request and returns a standard ReviewResult (summary, ' +
    'architecture impact, risks, bugs, performance, security, observability, breaking changes, ' +
    'recommendations and a 0-100 score). Large PRs are chunked automatically.',
  inputSchema: {
    ...workspaceField,
    ...repositoryField,
    pullRequestId: z.number().int().positive().describe('Pull request id.'),
    guidelines: z.string().optional().describe('Extra reviewer guidelines to apply.'),
  },
  async handler(args) {
    const context = resolveContext(args, deps.config, { requireRepository: true });
    const useCase = new PullRequestAnalyzeQuery(deps.codeReviewAgent);
    const output = await useCase.execute({
      context,
      pullRequestId: args.pullRequestId as number,
      guidelines: args.guidelines as string | undefined,
    });
    return jsonResult(output.data);
  },
});

export default tool;
