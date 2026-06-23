// =============================================================================
// AGGREGATE ROOT — Base class collecting domain events for dispatch after save
// =============================================================================
// Usage: extend this class, call addDomainEvent() in business methods.
// Repository calls pullDomainEvents() after saving to get events for outbox.

import { DomainEvent } from './domain-event';

export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  /**
   * Register a domain event to be dispatched after persistence.
   * Call this in entity business methods when a state transition occurs.
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Pull all pending domain events and clear the internal list.
   * Called by the repository after saving to dispatch via outbox.
   */
  pullDomainEvents(): DomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  /**
   * Check if there are pending domain events.
   */
  hasDomainEvents(): boolean {
    return this._domainEvents.length > 0;
  }
}
