import type { Agent } from '../../../../../agents/agent.contract.js';
import type {
  CodeReviewAgentInput,
  CodeReviewAgentOutput,
} from '../../../../../agents/code-review.agent.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/**
 * Orchestrates an AI code review by delegating to the CodeReviewAgent. The
 * use-case holds no business logic itself — the agent runs the autonomous
 * workflow and returns the standard ReviewResult.
 */
export class PullRequestAnalyzeQuery {
  constructor(
    private readonly codeReviewAgent: Agent<CodeReviewAgentInput, CodeReviewAgentOutput>,
  ) {}

  async execute(input: Input): Promise<Output> {
    const data = await this.codeReviewAgent.execute({
      context: input.context,
      pullRequestId: input.pullRequestId,
      guidelines: input.guidelines,
    });
    return { data };
  }
}
