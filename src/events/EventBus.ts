import type { DomainEvent } from './DomainEvent.js';
import type { EventHandler } from './EventHandler.js';

/**
 * Lightweight internal event system. Producers (agents/use-cases) depend only
 * on this interface; the concrete bus is chosen in the composition root.
 */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventName: string, handler: EventHandler): void;
}
