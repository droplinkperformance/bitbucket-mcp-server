import type { User } from '../user/types.js';

/**
 * Provider-agnostic user repository contract. Implemented per-provider under
 * `repositories/<provider>/user.repository.ts`. Use-cases/agents depend on this
 * interface only.
 */
export interface UserRepository {
  getCurrentUser(): Promise<User>;
}
