/**
 * Common contract for all autonomous agents.
 *
 * Design rules:
 *  - Tools never contain business logic.
 *  - Use-cases orchestrate.
 *  - Agents execute autonomous workflows and may use repository contracts,
 *    services, an LlmProvider and the EventBus.
 *
 * Agents depend only on provider-agnostic interfaces, never on a concrete SCM
 * or LLM vendor.
 */
export interface Agent<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
