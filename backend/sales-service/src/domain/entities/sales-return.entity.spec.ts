// =============================================================================
// SALES RETURN ENTITY — Flow Tests
// =============================================================================
// Tests the lifecycle: draft → approved → goods_received → completed
//                      draft → rejected

import { SalesReturn } from './sales-return.entity';
import { SalesReturnLine } from './sales-return-line.entity';

function createReturnLine(id = 'srl-1', qty = 3): SalesReturnLine {
  return SalesReturnLine.create(id, 'sol-1', 'item-1', 'Widget A', qty, 1000, 'Defective');
}

function createDraftReturn(): SalesReturn {
  return SalesReturn.createDraft('ret-1', 'so-1', 'cust-1', 'Defective product');
}

function createDraftWithLines(): SalesReturn {
  const ret = createDraftReturn();
  ret.addLine(createReturnLine());
  return ret;
}

describe('SalesReturn — Full Lifecycle Flow', () => {
  // =========================================================================
  // HAPPY PATH: draft → approved → goods_received → completed
  // =========================================================================
  describe('Happy path: draft → approved → goods_received → completed', () => {
    it('should complete the full return lifecycle', () => {
      const ret = createDraftWithLines();

      expect(ret.status).toBe('draft');

      ret.approve();
      expect(ret.status).toBe('approved');
      expect(ret.approvedAt).toBeInstanceOf(Date);

      ret.receiveGoods();
      expect(ret.status).toBe('goods_received');

      ret.complete();
      expect(ret.status).toBe('completed');
      expect(ret.completedAt).toBeInstanceOf(Date);
    });

    it('should correctly calculate totalRefundAmount', () => {
      const ret = createDraftReturn();
      ret.addLine(SalesReturnLine.create('srl-1', 'sol-1', 'item-1', 'A', 3, 1000));
      ret.addLine(SalesReturnLine.create('srl-2', 'sol-2', 'item-2', 'B', 2, 500));

      // 3×1000 + 2×500 = 4000
      expect(ret.totalRefundAmount).toBe(4000);
    });
  });

  // =========================================================================
  // REJECT PATH: draft → rejected
  // =========================================================================
  describe('Reject path: draft → rejected', () => {
    it('should reject from draft', () => {
      const ret = createDraftReturn();
      ret.reject();

      expect(ret.status).toBe('rejected');
    });

    it('should not allow reject from approved', () => {
      const ret = createDraftWithLines();
      ret.approve();

      expect(() => ret.reject()).toThrow(/Cannot.*reject/);
    });
  });

  // =========================================================================
  // FACTORY: createDraft()
  // =========================================================================
  describe('createDraft()', () => {
    it('should create draft with correct defaults', () => {
      const ret = createDraftReturn();

      expect(ret.id).toBe('ret-1');
      expect(ret.salesOrderId).toBe('so-1');
      expect(ret.customerId).toBe('cust-1');
      expect(ret.status).toBe('draft');
      expect(ret.reason).toBe('Defective product');
      expect(ret.totalRefundAmount).toBe(0);
      expect(ret.lines).toHaveLength(0);
      expect(ret.approvedAt).toBeNull();
      expect(ret.completedAt).toBeNull();
    });

    it('should reject empty reason', () => {
      expect(() => SalesReturn.createDraft('r1', 'so-1', 'c1', '')).toThrow(/reason/);
    });

    it('should reject whitespace-only reason', () => {
      expect(() => SalesReturn.createDraft('r1', 'so-1', 'c1', '   ')).toThrow(/reason/);
    });
  });

  // =========================================================================
  // ADD LINE GUARD
  // =========================================================================
  describe('addLine() — draft-only guard', () => {
    it('should allow adding lines in draft', () => {
      const ret = createDraftReturn();
      ret.addLine(createReturnLine());

      expect(ret.lines).toHaveLength(1);
    });

    it('should reject addLine from approved', () => {
      const ret = createDraftWithLines();
      ret.approve();

      expect(() => ret.addLine(createReturnLine('srl-2'))).toThrow(/Cannot.*addLine/);
    });

    it('should reject addLine from completed', () => {
      const ret = createDraftWithLines();
      ret.approve();
      ret.receiveGoods();
      ret.complete();

      expect(() => ret.addLine(createReturnLine('srl-2'))).toThrow(/Cannot.*addLine/);
    });
  });

  // =========================================================================
  // APPROVE GUARD
  // =========================================================================
  describe('approve() — guards', () => {
    it('should reject approve with no lines', () => {
      const ret = createDraftReturn();
      expect(() => ret.approve()).toThrow(/no lines/);
    });

    it('should reject approve from non-draft status', () => {
      const ret = createDraftWithLines();
      ret.approve();
      expect(() => ret.approve()).toThrow(/Cannot.*approve/);
    });
  });

  // =========================================================================
  // TRANSITION GUARDS — Wrong status
  // =========================================================================
  describe('Transition guards', () => {
    it('receiveGoods() should reject from draft', () => {
      const ret = createDraftWithLines();
      expect(() => ret.receiveGoods()).toThrow(/Cannot.*receiveGoods/);
    });

    it('complete() should reject from approved (must receive goods first)', () => {
      const ret = createDraftWithLines();
      ret.approve();
      expect(() => ret.complete()).toThrow(/Cannot.*complete/);
    });

    it('complete() should reject from draft', () => {
      const ret = createDraftReturn();
      expect(() => ret.complete()).toThrow(/Cannot.*complete/);
    });
  });

  // =========================================================================
  // SALES RETURN LINE
  // =========================================================================
  describe('SalesReturnLine.create()', () => {
    it('should create a valid line with calculated lineTotal', () => {
      const line = SalesReturnLine.create('srl-1', 'sol-1', 'item-1', 'Widget', 3, 1500);

      expect(line.quantity).toBe(3);
      expect(line.unitPrice).toBe(1500);
      expect(line.lineTotal).toBe(4500); // 3 × 1500
    });

    it('should accept decimal quantity', () => {
      const line = SalesReturnLine.create('srl-1', 'sol-1', 'item-1', 'Widget', 2.5, 1000);
      expect(line.lineTotal).toBe(2500);
    });

    it('should reject zero quantity', () => {
      expect(() => SalesReturnLine.create('srl-1', 'sol-1', 'item-1', 'W', 0, 1000))
        .toThrow(/positive number/);
    });

    it('should reject negative quantity', () => {
      expect(() => SalesReturnLine.create('srl-1', 'sol-1', 'item-1', 'W', -1, 1000))
        .toThrow(/positive number/);
    });

    it('should store optional reason', () => {
      const line = SalesReturnLine.create('srl-1', 'sol-1', 'item-1', 'W', 1, 100, 'Broken');
      expect(line.reason).toBe('Broken');
    });

    it('should default reason to null', () => {
      const line = SalesReturnLine.create('srl-1', 'sol-1', 'item-1', 'W', 1, 100);
      expect(line.reason).toBeNull();
    });
  });
});
