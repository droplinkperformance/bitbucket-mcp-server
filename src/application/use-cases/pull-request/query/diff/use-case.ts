import type { PullRequestRepository } from '../../../../../domain/contracts/pull-request.repository.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Returns the raw unified diff of a pull request. */
export class PullRequestDiffQuery {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async execute(input: Input): Promise<Output> {
    const diff = await this.pullRequests.getDiff(input.context, input.pullRequestId);
    return { data: { diff } };
  }
}
