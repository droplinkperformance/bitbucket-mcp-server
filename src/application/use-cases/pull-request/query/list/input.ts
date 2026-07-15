import type { BitbucketContext } from '../../../../../shared/context.js';
import type { PullRequestState } from '../../../../../domain/pull-request/types.js';

export interface Input {
  context: BitbucketContext;
  state?: PullRequestState;
  query?: string;
  limit?: number;
}
