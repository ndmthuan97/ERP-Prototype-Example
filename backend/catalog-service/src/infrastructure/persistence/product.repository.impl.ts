// =============================================================================
// PRISMA PRODUCT REPOSITORY — Implementation of IProductRepository
// =============================================================================
// Adapter in Hexagonal architecture:
// - Port (interface):    IProductRepository in domain layer
// - Adapter (implement): PrismaProductRepository in infrastructure layer
//
// Supports optimistic locking via version field on updates.

import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { Product } from '../../domain/entities/index.js';
import type {
  IProductRepository,
  PaginatedResult,
  SearchProductsParams,
} from '../../domain/repositories/index.js';
import { PrismaService } from './prisma.service.js';
import { getCorrelationId } from '@erp/shared';

function buildEventMeta() {
  return {
    correlationId: getCorrelationId() ?? null,
    occurredAt: new Date().toISOString(),
  };
}

type ProductRecord = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  defaultSalePrice: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaProductRepository implements IProductRepository {
  private readonly logger = new Logger(PrismaProductRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // MAPPING — DB record ↔ Domain entity
  // ==========================================================================

  private toDomain(record: ProductRecord): Product {
    return new Product({
      id: record.id,
      sku: record.sku,
      name: record.name,
      unit: record.unit,
      defaultSalePrice: record.defaultSalePrice.toNumber(),
      taxRate: record.taxRate.toNumber(),
      isActive: record.isActive,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  async findById(id: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findBySku(sku: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({
      where: { sku: sku.toUpperCase() },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async search(params: SearchProductsParams): Promise<PaginatedResult<Product>> {
    const { query, page, limit, isActive } = params;

    const whereCondition: Prisma.ProductWhereInput = {
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { sku: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
      ...(isActive !== undefined && { isActive }),
    };

    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.prisma.product.count({ where: whereCondition }),
      this.prisma.product.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      total,
      page,
      limit,
    };
  }

  // ==========================================================================
  // MUTATION METHODS
  // ==========================================================================

  async create(
    product: Product,
    event?: { eventType: string; payload: unknown },
  ): Promise<Product> {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            id: product.id,
            sku: product.sku,
            name: product.name,
            unit: product.unit,
            defaultSalePrice: product.defaultSalePrice,
            isActive: product.isActive,
            version: product.version,
          },
        });

        if (event) {
          await tx.outbox.create({
            data: {
              id: uuidv4(),
              aggregateType: 'Product',
              aggregateId: product.id,
              eventType: event.eventType,
              payload: {
                ...(event.payload as Record<string, unknown>),
                _meta: buildEventMeta(),
              },
            },
          });
        }

        return created;
      });

      this.logger.log(
        `Product created: id=${record.id}, sku="${record.sku}", name="${record.name}"`,
      );
      return this.toDomain(record);
    } catch (error) {
      // Unique SKU violation at DB level (race condition safety net)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `SKU "${product.sku}" already exists in the catalog`,
        );
      }
      throw error;
    }
  }

  async update(
    product: Product,
    events?: { eventType: string; payload: unknown }[],
  ): Promise<Product> {
    const record = await this.prisma.$transaction(async (tx) => {
      // Optimistic locking: only update if version matches
      const updated = await tx.product.updateMany({
        where: { id: product.id, version: product.version },
        data: {
          name: product.name,
          unit: product.unit,
          defaultSalePrice: product.defaultSalePrice,
          isActive: product.isActive,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          `Product "${product.id}" was modified concurrently (optimistic lock)`,
        );
      }

      if (events && events.length > 0) {
        for (const event of events) {
          await tx.outbox.create({
            data: {
              id: uuidv4(),
              aggregateType: 'Product',
              aggregateId: product.id,
              eventType: event.eventType,
              payload: {
                ...(event.payload as Record<string, unknown>),
                _meta: buildEventMeta(),
              },
            },
          });
        }
      }

      // Re-fetch the updated record to return correct state
      const freshRecord = await tx.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      return freshRecord;
    });

    this.logger.log(
      `Product updated: id=${record.id}, sku="${record.sku}", name="${record.name}"`,
    );
    return this.toDomain(record);
  }
}
