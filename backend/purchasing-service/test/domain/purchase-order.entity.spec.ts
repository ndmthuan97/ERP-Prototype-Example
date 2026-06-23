// =============================================================================
// UNIT TEST — PurchaseOrder Entity (Domain layer)
// =============================================================================
// Tests pure business logic — no DB, no NestJS.

import {
  PurchaseOrder,
  PurchaseOrderLine,
  InvalidPOStatusError,
  LineNotFoundError,
  OverReceiveError,
  EmptyPurchaseOrderError,
} from '../../src/domain/entities';
import type { PurchaseOrderProps } from '../../src/domain/entities';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makePO(overrides: Partial<PurchaseOrderProps> = {}): PurchaseOrder {
  return new PurchaseOrder({
    id: 'po-1',
    supplierId: 'supplier-1',
    status: 'draft',
    version: 0,
    lines: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function makeLine(
  overrides: Partial<{
    id: string;
    productId: string;
    productName: string;
    orderedQty: number;
    receivedQty: number;
    unitCost: number;
  }> = {},
): PurchaseOrderLine {
  return new PurchaseOrderLine({
    id: 'line-1',
    productId: 'prod-1',
    productName: 'Widget A',
    orderedQty: 100,
    receivedQty: 0,
    unitCost: 50,
    ...overrides,
  });
}

describe('PurchaseOrder entity', () => {
  // =========================================================================
  // addLine
  // =========================================================================
  describe('addLine', () => {
    it('adds a line to a draft PO', () => {
      const po = makePO();
      const line = makeLine();
      po.addLine(line);
      expect(po.lines).toHaveLength(1);
      expect(po.lines[0].id).toBe('line-1');
    });

    it('throws if PO is not in draft status', () => {
      const po = makePO({ status: 'placed' });
      expect(() => po.addLine(makeLine())).toThrow(InvalidPOStatusError);
    });
  });

  // =========================================================================
  // removeLine
  // =========================================================================
  describe('removeLine', () => {
    it('removes an existing line from a draft PO', () => {
      const po = makePO({ lines: [makeLine()] });
      po.removeLine('line-1');
      expect(po.lines).toHaveLength(0);
    });

    it('throws LineNotFoundError for unknown lineId', () => {
      const po = makePO({ lines: [makeLine()] });
      expect(() => po.removeLine('unknown')).toThrow(LineNotFoundError);
    });

    it('throws if PO is not in draft status', () => {
      const po = makePO({
        status: 'placed',
        lines: [makeLine()],
      });
      expect(() => po.removeLine('line-1')).toThrow(InvalidPOStatusError);
    });
  });

  // =========================================================================
  // place
  // =========================================================================
  describe('place', () => {
    it('transitions draft → placed when lines exist', () => {
      const po = makePO({ lines: [makeLine()] });
      po.place();
      expect(po.status).toBe('placed');
    });

    it('raises a purchase-order.placed domain event', () => {
      const po = makePO({ lines: [makeLine()] });
      po.place();
      const events = po.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('purchase-order.placed');
    });

    it('throws EmptyPurchaseOrderError if no lines', () => {
      const po = makePO();
      expect(() => po.place()).toThrow(EmptyPurchaseOrderError);
    });

    it('throws if not in draft status', () => {
      const po = makePO({
        status: 'placed',
        lines: [makeLine()],
      });
      expect(() => po.place()).toThrow(InvalidPOStatusError);
    });
  });

  // =========================================================================
  // receiveGoods
  // =========================================================================
  describe('receiveGoods', () => {
    it('partial receive → status becomes partially_received', () => {
      const line = makeLine({ orderedQty: 100, receivedQty: 0 });
      const po = makePO({ status: 'placed', lines: [line] });

      po.receiveGoods([{ lineId: 'line-1', quantity: 50 }]);
      expect(po.status).toBe('partially_received');
      expect(po.lines[0].receivedQty).toBe(50);
    });

    it('full receive → status becomes received', () => {
      const line = makeLine({ orderedQty: 100, receivedQty: 0 });
      const po = makePO({ status: 'placed', lines: [line] });

      po.receiveGoods([{ lineId: 'line-1', quantity: 100 }]);
      expect(po.status).toBe('received');
    });

    it('incremental receive across multiple calls', () => {
      const line = makeLine({ orderedQty: 100, receivedQty: 0 });
      const po = makePO({ status: 'placed', lines: [line] });

      po.receiveGoods([{ lineId: 'line-1', quantity: 40 }]);
      expect(po.status).toBe('partially_received');

      po.receiveGoods([{ lineId: 'line-1', quantity: 60 }]);
      expect(po.status).toBe('received');
    });

    it('raises goods.received domain event', () => {
      const line = makeLine({ orderedQty: 100, receivedQty: 0 });
      const po = makePO({ status: 'placed', lines: [line] });

      po.receiveGoods([{ lineId: 'line-1', quantity: 50 }]);
      const events = po.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('goods.received');
    });

    it('throws OverReceiveError when qty exceeds ordered', () => {
      const line = makeLine({ orderedQty: 100, receivedQty: 90 });
      const po = makePO({ status: 'placed', lines: [line] });

      expect(() =>
        po.receiveGoods([{ lineId: 'line-1', quantity: 20 }]),
      ).toThrow(OverReceiveError);
    });

    it('throws LineNotFoundError for unknown lineId', () => {
      const po = makePO({ status: 'placed', lines: [makeLine()] });
      expect(() =>
        po.receiveGoods([{ lineId: 'unknown', quantity: 10 }]),
      ).toThrow(LineNotFoundError);
    });

    it('throws if not in placed/partially_received status', () => {
      const po = makePO({ status: 'draft', lines: [makeLine()] });
      expect(() =>
        po.receiveGoods([{ lineId: 'line-1', quantity: 10 }]),
      ).toThrow(InvalidPOStatusError);
    });

    it('multi-line: partial on one, full on another → partially_received', () => {
      const line1 = makeLine({ id: 'l1', orderedQty: 100, receivedQty: 0 });
      const line2 = makeLine({ id: 'l2', orderedQty: 50, receivedQty: 0 });
      const po = makePO({ status: 'placed', lines: [line1, line2] });

      po.receiveGoods([
        { lineId: 'l1', quantity: 100 },
        { lineId: 'l2', quantity: 30 },
      ]);
      expect(po.status).toBe('partially_received');
    });
  });

  // =========================================================================
  // cancel
  // =========================================================================
  describe('cancel', () => {
    it('cancels a draft PO', () => {
      const po = makePO();
      po.cancel('No longer needed');
      expect(po.status).toBe('cancelled');
    });

    it('cancels a placed PO', () => {
      const po = makePO({ status: 'placed', lines: [makeLine()] });
      po.cancel();
      expect(po.status).toBe('cancelled');
    });

    it('throws if PO is partially_received', () => {
      const po = makePO({ status: 'partially_received' });
      expect(() => po.cancel()).toThrow(InvalidPOStatusError);
    });

    it('throws if PO is already received', () => {
      const po = makePO({ status: 'received' });
      expect(() => po.cancel()).toThrow(InvalidPOStatusError);
    });
  });

  // =========================================================================
  // totalCost
  // =========================================================================
  describe('totalCost', () => {
    it('sums orderedQty × unitCost across all lines', () => {
      const lines = [
        makeLine({ id: 'l1', orderedQty: 10, unitCost: 100 }),
        makeLine({ id: 'l2', orderedQty: 5, unitCost: 200 }),
      ];
      const po = makePO({ lines });
      expect(po.totalCost()).toBe(2000);
    });

    it('returns 0 for PO with no lines', () => {
      const po = makePO();
      expect(po.totalCost()).toBe(0);
    });
  });

  // =========================================================================
  // touch (version increment)
  // =========================================================================
  describe('touch', () => {
    it('increments version', () => {
      const po = makePO({ version: 3 });
      po.touch();
      expect(po.version).toBe(4);
    });
  });

  // =========================================================================
  // factory: createDraft
  // =========================================================================
  describe('createDraft', () => {
    it('creates a PO in draft status with empty lines', () => {
      const po = PurchaseOrder.createDraft('new-id', 'sup-1');
      expect(po.id).toBe('new-id');
      expect(po.supplierId).toBe('sup-1');
      expect(po.status).toBe('draft');
      expect(po.version).toBe(0);
      expect(po.lines).toHaveLength(0);
    });
  });
});
