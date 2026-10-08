import type { PullRequestRepository } from '../../../../../domain/contracts/pull-request.repository.js';
import { AppError } from '../../../../../shared/errors.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Updates an open pull request's title and/or description. */
export class PullRequestUpdateCommand {
  constructor(private readonly pullRequests: PullRequestRepository) {}

  async execute(input: Input): Promise<Output> {
    const hasTitle = input.title !== undefined;
    const hasDescription = input.description !== undefined;

    if (!hasTitle && !hasDescription) {
      throw new AppError(
        'At least one of "title" or "description" is required to update a pull request.',
        { status: 400, code: 'missing_update_fields' },
      );
    }

    if (hasTitle && input.title!.trim().length === 0) {
      throw new AppError('Pull request title cannot be empty.', {
        status: 400,
        code: 'invalid_title',
      });
    }

    const data = await this.pullRequests.update({
      context: input.context,
      pullRequestId: input.pullRequestId,
      title: hasTitle ? input.title!.trim() : undefined,
      description: hasDescription ? input.description : undefined,
    });
    return { data };
  }
}
