import type { BitbucketContext } from '../../../../../shared/context.js';

export interface Input {
  context: BitbucketContext;
  title: string;
  sourceBranch: string;
  destinationBranch?: string;
  description?: string;
  closeSourceBranch?: boolean;
  reviewers?: string[];
}
