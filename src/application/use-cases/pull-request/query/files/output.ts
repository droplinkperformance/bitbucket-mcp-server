import type { PullRequestFileChange } from '../../../../../domain/pull-request/types.js';

export interface Output {
  data: PullRequestFileChange[];
}
