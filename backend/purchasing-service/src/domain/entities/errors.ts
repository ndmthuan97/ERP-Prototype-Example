// =============================================================================
// DOMAIN ERRORS — Purchase Order bounded context
// =============================================================================

/** Thrown when a status transition is not allowed by the state machine */
export class InvalidPOStatusError extends Error {
  constructor(currentStatus: string, action: string) {
    super(
      `Cannot "${action}" when purchase order is in status "${currentStatus}"`,
    );
    this.name = 'InvalidPOStatusError';
  }
}

/** Thrown when a referenced line is not found in the purchase order */
export class LineNotFoundError extends Error {
  constructor(lineId: string) {
    super(`Purchase order line "${lineId}" not found`);
    this.name = 'LineNotFoundError';
  }
}

/** Thrown when receivedQty would exceed orderedQty */
export class OverReceiveError extends Error {
  constructor(lineId: string, orderedQty: number, wouldBeReceived: number) {
    super(
      `Line "${lineId}": receiving would result in ${wouldBeReceived} units, ` +
        `but only ${orderedQty} were ordered`,
    );
    this.name = 'OverReceiveError';
  }
}

/** Thrown when trying to place a PO with no lines */
export class EmptyPurchaseOrderError extends Error {
  constructor() {
    super('Cannot place a purchase order with no lines');
    this.name = 'EmptyPurchaseOrderError';
  }
}
