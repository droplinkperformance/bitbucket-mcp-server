import type { PullRequestRepository } from '../../../../../domain/contracts/pull-request.repository.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Creates a pull request. */
export class PullRequestCreateCommand {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async execute(input: Input): Promise<Output> {
    const data = await this.pullRequests.create({
      context: input.context,
      title: input.title,
      sourceBranch: input.sourceBranch,
      destinationBranch: input.destinationBranch,
      description: input.description,
      closeSourceBranch: input.closeSourceBranch,
      reviewers: input.reviewers,
    });
    return { data };
  }
}
