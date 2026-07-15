/** Provider-agnostic, normalized user. */
export interface User {
  accountId: string;
  username?: string;
  displayName: string;
  nickname?: string;
  type?: string;
}
