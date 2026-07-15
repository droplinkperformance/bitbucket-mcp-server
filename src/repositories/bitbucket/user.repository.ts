import type { UserRepository } from '../../domain/contracts/user.repository.js';
import type { User } from '../../domain/user/types.js';
import type { BitbucketClient } from '../../clients/bitbucket/BitbucketClient.js';
import type { BitbucketAccount } from '../../clients/bitbucket/types.js';
import { endpoints } from '../../clients/bitbucket/endpoints.js';
import { cacheKeys } from '../../cache/keys.js';
import { toUser } from './mappers.js';

/** Bitbucket implementation of the provider-agnostic UserRepository contract. */
export class BitbucketUserRepository implements UserRepository {
  constructor(
    private readonly client: BitbucketClient,
    private readonly cacheTtlSeconds: number,
  ) {}

  async getCurrentUser(): Promise<User> {
    const raw = await this.client.get<BitbucketAccount>(endpoints.currentUser(), {
      cacheTtlSeconds: this.cacheTtlSeconds,
      cacheKey: cacheKeys.currentUser(),
    });
    const user = toUser(raw);
    if (!user) {
      throw new Error('Bitbucket returned an empty current user.');
    }
    return user;
  }
}
