import type { PullRequestRepository } from '../../../../../domain/contracts/pull-request.repository.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Adds a comment (optionally inline) to a pull request. */
export class PullRequestCommentCommand {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async execute(input: Input): Promise<Output> {
    const data = await this.pullRequests.addComment({
      context: input.context,
      pullRequestId: input.pullRequestId,
      content: input.content,
      inline: input.inline,
    });
    return { data };
  }
}
