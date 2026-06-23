// =============================================================================
// DOMAIN EVENT — Base interface for all domain events
// =============================================================================

export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly payload: Record<string, unknown>;
}
