import type { BitbucketContext } from '../../../../../shared/context.js';
import type { InlineLocation } from '../../../../../domain/pull-request/types.js';

export interface Input {
  context: BitbucketContext;
  pullRequestId: number;
  content: string;
  inline?: InlineLocation;
}
