// =============================================================================
// UNIT TEST — PurchaseOrderLine Entity
// =============================================================================

import { PurchaseOrderLine, OverReceiveError } from "../../src/domain/entities";

describe("PurchaseOrderLine entity", () => {
  describe("create (factory)", () => {
    it("creates a line with receivedQty = 0", () => {
      const line = PurchaseOrderLine.create("l1", "prod-1", "Widget", 10, 50);
      expect(line.id).toBe("l1");
      expect(line.orderedQty).toBe(10);
      expect(line.receivedQty).toBe(0);
      expect(line.unitCost).toBe(50);
    });

    it("throws on non-positive orderedQty", () => {
      expect(() => PurchaseOrderLine.create("l1", "p", "X", 0, 10)).toThrow(
        "orderedQty must be a positive number",
      );
    });

    it("throws on non-positive unitCost", () => {
      expect(() => PurchaseOrderLine.create("l1", "p", "X", 10, -5)).toThrow(
        "unitCost must be a positive number",
      );
    });
  });

  describe("receive", () => {
    it("increases receivedQty", () => {
      const line = PurchaseOrderLine.create("l1", "p", "X", 100, 10);
      line.receive(30);
      expect(line.receivedQty).toBe(30);
    });

    it("throws OverReceiveError when exceeding orderedQty", () => {
      const line = PurchaseOrderLine.create("l1", "p", "X", 100, 10);
      line.receive(90);
      expect(() => line.receive(20)).toThrow(OverReceiveError);
    });
  });

  describe("isFullyReceived", () => {
    it("returns true when receivedQty >= orderedQty", () => {
      const line = PurchaseOrderLine.create("l1", "p", "X", 10, 5);
      line.receive(10);
      expect(line.isFullyReceived()).toBe(true);
    });

    it("returns false when receivedQty < orderedQty", () => {
      const line = PurchaseOrderLine.create("l1", "p", "X", 10, 5);
      line.receive(5);
      expect(line.isFullyReceived()).toBe(false);
    });
  });

  describe("lineTotal", () => {
    it("returns orderedQty × unitCost", () => {
      const line = PurchaseOrderLine.create("l1", "p", "X", 10, 25);
      expect(line.lineTotal()).toBe(250);
    });
  });
});
