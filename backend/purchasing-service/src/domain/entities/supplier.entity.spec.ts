// =============================================================================
// SUPPLIER ENTITY — Flow Tests
// =============================================================================
// Tests CRUD lifecycle + activate/deactivate + validation

import { Supplier } from './supplier.entity';

describe('Supplier — Full Lifecycle Flow', () => {
  // =========================================================================
  // FACTORY
  // =========================================================================
  describe('create()', () => {
    it('should create an active supplier with defaults', () => {
      const supplier = Supplier.create('sup-1', 'ACME Corp');

      expect(supplier.id).toBe('sup-1');
      expect(supplier.name).toBe('ACME Corp');
      expect(supplier.taxCode).toBeNull();
      expect(supplier.contactName).toBeNull();
      expect(supplier.contactPhone).toBeNull();
      expect(supplier.contactEmail).toBeNull();
      expect(supplier.paymentTermDays).toBe(30);
      expect(supplier.isActive).toBe(true);
    });

    it('should accept all optional fields', () => {
      const supplier = Supplier.create('sup-1', 'ACME Corp', {
        taxCode: '0123456789',
        contactName: 'John Doe',
        contactPhone: '0901234567',
        contactEmail: 'john@acme.com',
        paymentTermDays: 45,
      });

      expect(supplier.taxCode).toBe('0123456789');
      expect(supplier.contactName).toBe('John Doe');
      expect(supplier.paymentTermDays).toBe(45);
    });

    it('should reject empty name', () => {
      expect(() => Supplier.create('s1', '')).toThrow(/name/i);
    });

    it('should reject whitespace-only name', () => {
      expect(() => Supplier.create('s1', '   ')).toThrow(/name/i);
    });

    it('should trim name', () => {
      const supplier = Supplier.create('s1', '  ACME  ');
      expect(supplier.name).toBe('ACME');
    });
  });

  // =========================================================================
  // ACTIVATE / DEACTIVATE
  // =========================================================================
  describe('activate/deactivate toggle', () => {
    it('should deactivate an active supplier', () => {
      const supplier = Supplier.create('s1', 'Test');
      expect(supplier.isActive).toBe(true);

      supplier.deactivate();
      expect(supplier.isActive).toBe(false);
    });

    it('should activate an inactive supplier', () => {
      const supplier = Supplier.create('s1', 'Test');
      supplier.deactivate();
      expect(supplier.isActive).toBe(false);

      supplier.activate();
      expect(supplier.isActive).toBe(true);
    });

    it('should update updatedAt on toggle', () => {
      const supplier = Supplier.create('s1', 'Test');
      const before = supplier.updatedAt;

      supplier.deactivate();
      expect(supplier.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // =========================================================================
  // UPDATE
  // =========================================================================
  describe('update(changes)', () => {
    it('should update name', () => {
      const supplier = Supplier.create('s1', 'Old Name');
      supplier.update({ name: 'New Name' });
      expect(supplier.name).toBe('New Name');
    });

    it('should reject empty name on update', () => {
      const supplier = Supplier.create('s1', 'Test');
      expect(() => supplier.update({ name: '' })).toThrow(/name/i);
    });

    it('should update paymentTermDays', () => {
      const supplier = Supplier.create('s1', 'Test');
      supplier.update({ paymentTermDays: 60 });
      expect(supplier.paymentTermDays).toBe(60);
    });

    it('should allow paymentTermDays = 0 (immediate payment)', () => {
      const supplier = Supplier.create('s1', 'Test');
      supplier.update({ paymentTermDays: 0 });
      expect(supplier.paymentTermDays).toBe(0);
    });

    it('should reject negative paymentTermDays', () => {
      const supplier = Supplier.create('s1', 'Test');
      expect(() => supplier.update({ paymentTermDays: -1 })).toThrow(/Payment term/);
    });

    it('should update contact info', () => {
      const supplier = Supplier.create('s1', 'Test');
      supplier.update({
        contactName: 'Jane',
        contactPhone: '0909090909',
        contactEmail: 'jane@test.com',
      });

      expect(supplier.contactName).toBe('Jane');
      expect(supplier.contactPhone).toBe('0909090909');
      expect(supplier.contactEmail).toBe('jane@test.com');
    });

    it('should allow setting contact fields to null', () => {
      const supplier = Supplier.create('s1', 'Test', { contactName: 'John' });
      supplier.update({ contactName: null });
      expect(supplier.contactName).toBeNull();
    });

    it('should preserve fields not in changes', () => {
      const supplier = Supplier.create('s1', 'Test', {
        taxCode: '123',
        contactName: 'John',
      });
      supplier.update({ taxCode: '456' });

      expect(supplier.taxCode).toBe('456');
      expect(supplier.contactName).toBe('John'); // unchanged
      expect(supplier.name).toBe('Test'); // unchanged
    });
  });
});
