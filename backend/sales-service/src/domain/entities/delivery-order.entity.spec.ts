// =============================================================================
// DELIVERY ORDER ENTITY — Flow Tests
// =============================================================================
// Tests the 6-state lifecycle: draft → picking → packed → shipped → delivered
//                                                         shipped → failed

import { DeliveryOrder } from './delivery-order.entity';
import { DeliveryLine } from './delivery-line.entity';

function createLine(id = 'dl-1'): DeliveryLine {
  return DeliveryLine.create(id, 'sol-1', 'item-1', 'Widget A', 10);
}

function createDraftWithLines(): DeliveryOrder {
  const delivery = DeliveryOrder.createFromOrder('do-1', 'so-1');
  delivery.addLine(createLine());
  return delivery;
}

describe('DeliveryOrder — Full Lifecycle Flow', () => {
  // =========================================================================
  // HAPPY PATH
  // =========================================================================
  describe('Happy path: draft → picking → packed → shipped → delivered', () => {
    it('should complete the full delivery lifecycle', () => {
      const delivery = createDraftWithLines();

      expect(delivery.status).toBe('draft');

      delivery.startPicking();
      expect(delivery.status).toBe('picking');

      delivery.pack();
      expect(delivery.status).toBe('packed');

      delivery.ship();
      expect(delivery.status).toBe('shipped');

      delivery.confirmDelivery();
      expect(delivery.status).toBe('delivered');
    });

    it('should update updatedAt on each transition', () => {
      const delivery = createDraftWithLines();
      const timestamps: number[] = [delivery.updatedAt.getTime()];

      delivery.startPicking();
      timestamps.push(delivery.updatedAt.getTime());

      delivery.pack();
      timestamps.push(delivery.updatedAt.getTime());

      delivery.ship();
      timestamps.push(delivery.updatedAt.getTime());

      delivery.confirmDelivery();
      timestamps.push(delivery.updatedAt.getTime());

      // Each transition should have >= previous timestamp
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  // =========================================================================
  // FACTORY
  // =========================================================================
  describe('createFromOrder()', () => {
    it('should create a draft delivery with correct defaults', () => {
      const delivery = DeliveryOrder.createFromOrder('do-1', 'so-1');

      expect(delivery.id).toBe('do-1');
      expect(delivery.salesOrderId).toBe('so-1');
      expect(delivery.status).toBe('draft');
      expect(delivery.failReason).toBeNull();
      expect(delivery.version).toBe(0);
      expect(delivery.lines).toHaveLength(0);
    });
  });

  // =========================================================================
  // ADD LINE GUARD
  // =========================================================================
  describe('addLine() — draft-only guard', () => {
    it('should allow adding lines in draft status', () => {
      const delivery = DeliveryOrder.createFromOrder('do-1', 'so-1');
      delivery.addLine(createLine());

      expect(delivery.lines).toHaveLength(1);
    });

    it.each<string>(['picking', 'packed', 'shipped', 'delivered', 'failed'])(
      'should reject addLine when status is %s',
      (status) => {
        const delivery = new DeliveryOrder({
          id: 'do-1',
          salesOrderId: 'so-1',
          status: status as any,
          failReason: null,
          version: 0,
          lines: [createLine()],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        expect(() => delivery.addLine(createLine('dl-2'))).toThrow(
          /Cannot.*addLine/,
        );
      },
    );
  });

  // =========================================================================
  // START PICKING GUARD
  // =========================================================================
  describe('startPicking()', () => {
    it('should reject when no lines', () => {
      const delivery = DeliveryOrder.createFromOrder('do-1', 'so-1');
      expect(() => delivery.startPicking()).toThrow(/no lines/);
    });

    it('should reject when not draft', () => {
      const delivery = createDraftWithLines();
      delivery.startPicking();
      expect(() => delivery.startPicking()).toThrow(/Cannot.*startPicking/);
    });
  });

  // =========================================================================
  // TRANSITION GUARDS — Wrong status
  // =========================================================================
  describe('Transition guards', () => {
    it('pack() should reject from draft', () => {
      const delivery = createDraftWithLines();
      expect(() => delivery.pack()).toThrow(/Cannot.*pack/);
    });

    it('ship() should reject from picking', () => {
      const delivery = createDraftWithLines();
      delivery.startPicking();
      expect(() => delivery.ship()).toThrow(/Cannot.*ship/);
    });

    it('confirmDelivery() should reject from packed', () => {
      const delivery = createDraftWithLines();
      delivery.startPicking();
      delivery.pack();
      expect(() => delivery.confirmDelivery()).toThrow(
        /Cannot.*confirmDelivery/,
      );
    });

    it('markFailed() should reject from packed (not yet shipped)', () => {
      const delivery = createDraftWithLines();
      delivery.startPicking();
      delivery.pack();
      expect(() => delivery.markFailed('reason')).toThrow(/Cannot.*markFailed/);
    });
  });

  // =========================================================================
  // FAILED PATH
  // =========================================================================
  describe('Failure path: shipped → failed', () => {
    it('should transition to failed with reason', () => {
      const delivery = createDraftWithLines();
      delivery.startPicking();
      delivery.pack();
      delivery.ship();

      delivery.markFailed('Customer refused delivery');

      expect(delivery.status).toBe('failed');
      expect(delivery.failReason).toBe('Customer refused delivery');
    });
  });

  // =========================================================================
  // DELIVERY LINE VALIDATION
  // =========================================================================
  describe('DeliveryLine.create()', () => {
    it('should create a valid delivery line', () => {
      const line = DeliveryLine.create(
        'dl-1',
        'sol-1',
        'item-1',
        'Widget',
        5.5,
      );
      expect(line.quantity).toBe(5.5);
      expect(line.itemName).toBe('Widget');
    });

    it('should reject zero quantity', () => {
      expect(() =>
        DeliveryLine.create('dl-1', 'sol-1', 'item-1', 'Widget', 0),
      ).toThrow(/positive number/);
    });

    it('should reject negative quantity', () => {
      expect(() =>
        DeliveryLine.create('dl-1', 'sol-1', 'item-1', 'Widget', -1),
      ).toThrow(/positive number/);
    });
  });
});
