import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateProductCommand } from '../../src/application/commands/create-product.command';
import { UpdateProductCommand } from '../../src/application/commands/update-product.command';
import { DeactivateProductCommand } from '../../src/application/commands/deactivate-product.command';
import { ActivateProductCommand } from '../../src/application/commands/activate-product.command';
import { Product } from '../../src/domain/entities/product.entity';
import type { IProductRepository } from '../../src/domain/repositories/product.repository';

function createMockRepository(): jest.Mocked<IProductRepository> {
  return {
    findById: jest.fn(),
    findBySku: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

describe('CreateProductCommand', () => {
  let command: CreateProductCommand;
  let repo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    command = new CreateProductCommand(repo);
  });

  it('should create a product successfully', async () => {
    repo.findBySku.mockResolvedValue(null);
    repo.create.mockImplementation(async (product) => product);

    const result = await command.execute({
      sku: 'NEW-SKU',
      name: 'New Product',
      unit: 'PCS',
      defaultSalePrice: 100,
    });

    expect(result.sku).toBe('NEW-SKU');
    expect(result.name).toBe('New Product');
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('should throw ConflictException for duplicate SKU', async () => {
    const existing = Product.create('id-1', 'DUP-SKU', 'Existing', 'PCS', 50);
    repo.findBySku.mockResolvedValue(existing);

    await expect(
      command.execute({
        sku: 'DUP-SKU',
        name: 'Another Product',
        defaultSalePrice: 100,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw ZodError for missing required fields', async () => {
    await expect(command.execute({})).rejects.toThrow();
  });

  it('should throw ZodError for negative price', async () => {
    await expect(
      command.execute({
        sku: 'SKU-NEG',
        name: 'Product',
        defaultSalePrice: -10,
      }),
    ).rejects.toThrow();
  });
});

describe('UpdateProductCommand', () => {
  let command: UpdateProductCommand;
  let repo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    command = new UpdateProductCommand(repo);
  });

  it('should update product name', async () => {
    const product = Product.create('id-1', 'SKU-UPD', 'Old Name', 'PCS', 100);
    repo.findById.mockResolvedValue(product);
    repo.update.mockImplementation(async (p) => p);

    const result = await command.execute({ id: 'id-1', name: 'New Name' });
    expect(result.name).toBe('New Name');
  });

  it('should throw NotFoundException for non-existent product', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      command.execute({ id: 'non-existent', name: 'Test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update price and unit together', async () => {
    const product = Product.create('id-1', 'SKU-UPD2', 'Product', 'PCS', 100);
    repo.findById.mockResolvedValue(product);
    repo.update.mockImplementation(async (p) => p);

    const result = await command.execute({
      id: 'id-1',
      defaultSalePrice: 250,
      unit: 'KG',
    });
    expect(result.defaultSalePrice).toBe(250);
    expect(result.unit).toBe('KG');
  });
});

describe('DeactivateProductCommand', () => {
  let command: DeactivateProductCommand;
  let repo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    command = new DeactivateProductCommand(repo);
  });

  it('should deactivate an active product', async () => {
    const product = Product.create('id-1', 'SKU-DEACT', 'Product', 'PCS', 100);
    repo.findById.mockResolvedValue(product);
    repo.update.mockImplementation(async (p) => p);

    const result = await command.execute('id-1');
    expect(result.isActive).toBe(false);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException for non-existent product', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(command.execute('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ActivateProductCommand', () => {
  let command: ActivateProductCommand;
  let repo: jest.Mocked<IProductRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    command = new ActivateProductCommand(repo);
  });

  it('should activate an inactive product', async () => {
    const product = Product.create('id-1', 'SKU-ACT', 'Product', 'PCS', 100);
    product.deactivate();
    product.pullDomainEvents(); // Clear events
    repo.findById.mockResolvedValue(product);
    repo.update.mockImplementation(async (p) => p);

    const result = await command.execute('id-1');
    expect(result.isActive).toBe(true);
  });

  it('should throw NotFoundException for non-existent product', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(command.execute('non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
