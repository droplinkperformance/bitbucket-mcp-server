import type { Config } from './infrastructure/config/env.js';
import type { Logger } from './infrastructure/logger/pino.js';
import type { UserRepository } from './domain/contracts/user.repository.js';
import type { PullRequestRepository } from './domain/contracts/pull-request.repository.js';
import type { Agent } from './agents/agent.contract.js';
import type {
  CodeReviewAgentInput,
  CodeReviewAgentOutput,
} from './agents/code-review.agent.js';
import type { EventBus } from './events/EventBus.js';

/**
 * The set of provider-agnostic dependencies tools/use-cases receive. Built once
 * in the composition root (container.ts) and injected into every tool factory.
 * Tools depend on these interfaces only, never on concrete implementations.
 */
export interface AppDependencies {
  config: Config;
  logger: Logger;
  userRepository: UserRepository;
  pullRequestRepository: PullRequestRepository;
  codeReviewAgent: Agent<CodeReviewAgentInput, CodeReviewAgentOutput>;
  eventBus: EventBus;
}
