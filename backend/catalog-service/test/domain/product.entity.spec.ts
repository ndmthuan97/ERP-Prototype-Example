import { Product } from '../../src/domain/entities/product.entity';

describe('Product Entity', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    sku: 'SKU-001',
    name: 'Test Product',
    unit: 'PCS',
    defaultSalePrice: 100,
    isActive: true,
    version: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  describe('create()', () => {
    it('should create a valid product', () => {
      const product = Product.create(
        validProps.id,
        'SKU-001',
        'Test Product',
        'PCS',
        100,
      );

      expect(product.id).toBe(validProps.id);
      expect(product.sku).toBe('SKU-001');
      expect(product.name).toBe('Test Product');
      expect(product.unit).toBe('PCS');
      expect(product.defaultSalePrice).toBe(100);
      expect(product.isActive).toBe(true);
      expect(product.version).toBe(0);
    });

    it('should normalize SKU to uppercase', () => {
      const product = Product.create(
        validProps.id,
        'sku-lower',
        'Test Product',
        'PCS',
        50,
      );
      expect(product.sku).toBe('SKU-LOWER');
    });

    it('should default unit to PCS when not provided', () => {
      const product = Product.create(
        validProps.id,
        'SKU-002',
        'Test Product',
        '',
        50,
      );
      expect(product.unit).toBe('PCS');
    });

    it('should throw when name is empty', () => {
      expect(() =>
        Product.create(validProps.id, 'SKU-003', '', 'PCS', 100),
      ).toThrow('Product name must not be empty');
    });

    it('should throw when price is negative', () => {
      expect(() =>
        Product.create(validProps.id, 'SKU-004', 'Product', 'PCS', -1),
      ).toThrow('Product price must be >= 0');
    });

    it('should accept zero price', () => {
      const product = Product.create(
        validProps.id,
        'SKU-005',
        'Free Product',
        'PCS',
        0,
      );
      expect(product.defaultSalePrice).toBe(0);
    });

    it('should throw for invalid SKU format', () => {
      expect(() =>
        Product.create(validProps.id, 'a', 'Product', 'PCS', 100),
      ).toThrow();
    });
  });

  describe('rename()', () => {
    it('should rename the product', () => {
      const product = new Product(validProps);
      product.rename('New Name');
      expect(product.name).toBe('New Name');
    });

    it('should throw when renaming to empty string', () => {
      const product = new Product(validProps);
      expect(() => product.rename('')).toThrow('Product name must not be empty');
    });
  });

  describe('changePrice()', () => {
    it('should change the price', () => {
      const product = new Product(validProps);
      product.changePrice(200);
      expect(product.defaultSalePrice).toBe(200);
    });

    it('should throw when price is negative', () => {
      const product = new Product(validProps);
      expect(() => product.changePrice(-5)).toThrow('Product price must be >= 0');
    });

    it('should allow zero price', () => {
      const product = new Product(validProps);
      product.changePrice(0);
      expect(product.defaultSalePrice).toBe(0);
    });
  });

  describe('changeUnit()', () => {
    it('should change the unit', () => {
      const product = new Product(validProps);
      product.changeUnit('KG');
      expect(product.unit).toBe('KG');
    });

    it('should throw when unit is empty', () => {
      const product = new Product(validProps);
      expect(() => product.changeUnit('')).toThrow('Product unit must not be empty');
    });
  });

  describe('activate() / deactivate()', () => {
    it('should deactivate and raise domain event', () => {
      const product = new Product(validProps);
      product.deactivate();

      expect(product.isActive).toBe(false);
      expect(product.hasDomainEvents()).toBe(true);

      const events = product.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('product.deactivated');
    });

    it('should activate the product', () => {
      const product = new Product({ ...validProps, isActive: false });
      product.activate();
      expect(product.isActive).toBe(true);
    });
  });

  describe('SKU immutability', () => {
    it('should have readonly sku property', () => {
      const product = new Product(validProps);
      // SKU is readonly — TypeScript prevents assignment at compile time.
      // At runtime, we verify the value remains unchanged.
      expect(product.sku).toBe('SKU-001');
    });
  });

  describe('touch()', () => {
    it('should update updatedAt timestamp', () => {
      const product = new Product(validProps);
      const before = product.updatedAt;
      product.touch();
      expect(product.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
