import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventBus } from '../events/InMemoryEventBus.js';
import { createDomainEvent, reviewCompletedEvent } from '../events/DomainEvent.js';

describe('InMemoryEventBus', () => {
  it('delivers events to subscribers of that name', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe('ReviewCompletedEvent', handler);

    const event = reviewCompletedEvent({ workspace: 'w', pullRequestId: 1, score: 90, summary: 's' });
    await bus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).toMatchObject({ name: 'ReviewCompletedEvent' });
  });

  it('does not deliver to unrelated subscribers', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe('OtherEvent', handler);
    await bus.publish(createDomainEvent('ReviewCompletedEvent', {}));
    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers to wildcard subscribers', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe('*', handler);
    await bus.publish(createDomainEvent('AnyEvent', {}));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates failing handlers and reports via onError', async () => {
    const onError = vi.fn();
    const bus = new InMemoryEventBus({ onError });
    const good = vi.fn();
    bus.subscribe('E', () => {
      throw new Error('boom');
    });
    bus.subscribe('E', good);

    await expect(bus.publish(createDomainEvent('E', {}))).resolves.toBeUndefined();
    expect(good).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
