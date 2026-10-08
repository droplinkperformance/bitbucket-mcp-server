import type { BitbucketContext } from '../../../../../shared/context.js';

export interface Input {
  context: BitbucketContext;
  pullRequestId: number;
  /** When set, replaces the PR title. Must be non-empty. */
  title?: string;
  /**
   * When set, replaces the PR description.
   * Pass an empty string to clear the description.
   */
  description?: string;
}
