import type { DomainEvent } from './DomainEvent.js';

/** A subscriber invoked when a matching event is published. */
export type EventHandler<E extends DomainEvent = DomainEvent> = (event: E) => void | Promise<void>;
