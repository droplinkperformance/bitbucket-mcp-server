import type { PullRequestRepository } from '../../../../../domain/contracts/pull-request.repository.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Lists pull requests in a repository (auto-paginated up to `limit`). */
export class PullRequestListQuery {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async execute(input: Input): Promise<Output> {
    const data = await this.pullRequests.list({
      context: input.context,
      state: input.state,
      query: input.query,
      limit: input.limit,
    });
    return { data };
  }
}
