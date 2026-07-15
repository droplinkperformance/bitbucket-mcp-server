/** Bitbucket Cloud paginated envelope. */
export interface BitbucketPage<T> {
  values: T[];
  page?: number;
  pagelen?: number;
  size?: number;
  next?: string;
  previous?: string;
}

export interface BitbucketLink {
  href: string;
  name?: string;
}

export interface BitbucketLinks {
  self?: BitbucketLink;
  html?: BitbucketLink;
  [key: string]: BitbucketLink | BitbucketLink[] | undefined;
}

export interface BitbucketAccount {
  type?: string;
  account_id?: string;
  uuid?: string;
  nickname?: string;
  display_name?: string;
  username?: string;
  links?: BitbucketLinks;
}

export interface BitbucketBranchTarget {
  hash?: string;
}

export interface BitbucketBranchRef {
  branch?: { name?: string };
  commit?: BitbucketBranchTarget;
  repository?: { full_name?: string; name?: string };
}

export interface BitbucketPullRequest {
  id: number;
  title: string;
  description?: string;
  state: string;
  author?: BitbucketAccount;
  source?: BitbucketBranchRef;
  destination?: BitbucketBranchRef;
  created_on?: string;
  updated_on?: string;
  comment_count?: number;
  links?: BitbucketLinks;
}

export interface BitbucketComment {
  id: number;
  content?: { raw?: string; markup?: string; html?: string };
  user?: BitbucketAccount;
  created_on?: string;
  deleted?: boolean;
  inline?: { path: string; from?: number | null; to?: number | null };
}

export interface BitbucketDiffStat {
  type?: string;
  status?: string;
  lines_added?: number;
  lines_removed?: number;
  old?: { path?: string } | null;
  new?: { path?: string } | null;
}

export interface BitbucketCommit {
  hash: string;
  message?: string;
  date?: string;
  author?: { raw?: string; user?: BitbucketAccount };
}
