import type { BitbucketContext } from '../../../../../shared/context.js';

export interface Input {
  context: BitbucketContext;
  pullRequestId: number;
  guidelines?: string;
}
