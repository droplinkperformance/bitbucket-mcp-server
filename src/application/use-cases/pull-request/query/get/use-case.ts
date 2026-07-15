import type { PullRequestRepository } from '../../../../../domain/contracts/pull-request.repository.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Fetches a single pull request by id. */
export class PullRequestGetQuery {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async execute(input: Input): Promise<Output> {
    const data = await this.pullRequests.get(input.context, input.pullRequestId);
    return { data };
  }
}
