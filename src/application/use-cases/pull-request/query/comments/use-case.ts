import type { PullRequestRepository } from '../../../../../domain/contracts/pull-request.repository.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Lists the comments on a pull request. */
export class PullRequestCommentsQuery {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async execute(input: Input): Promise<Output> {
    const data = await this.pullRequests.getComments(input.context, input.pullRequestId);
    return { data };
  }
}
