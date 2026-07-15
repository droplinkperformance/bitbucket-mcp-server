import type { DomainEvent } from './DomainEvent.js';
import type { EventBus } from './EventBus.js';
import type { EventHandler } from './EventHandler.js';

const WILDCARD = '*';

/**
 * Default in-process event bus. Handlers run concurrently; a failing handler is
 * isolated (logged via the optional logger) and never breaks the producer or
 * other handlers. Swap for a Redis/Kafka-backed bus later without touching
 * producers.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  constructor(private readonly options: { onError?: (error: unknown, event: DomainEvent) => void } = {}) {}

  subscribe(eventName: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventName) ?? new Set<EventHandler>();
    existing.add(handler);
    this.handlers.set(eventName, existing);
  }

  async publish(event: DomainEvent): Promise<void> {
    const targeted = this.handlers.get(event.name) ?? new Set<EventHandler>();
    const wildcard = this.handlers.get(WILDCARD) ?? new Set<EventHandler>();
    const all = [...targeted, ...wildcard];

    await Promise.all(
      all.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          this.options.onError?.(error, event);
        }
      }),
    );
  }
}
