import type { UserRepository } from '../../../../../domain/contracts/user.repository.js';
import type { Input } from './input.js';
import type { Output } from './output.js';

/** Returns the authenticated user. */
export class UserGetCurrentQuery {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(_input: Input = {}): Promise<Output> {
    const user = await this.userRepository.getCurrentUser();
    return { data: user };
  }
}
