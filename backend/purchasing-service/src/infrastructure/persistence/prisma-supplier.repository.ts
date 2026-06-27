// =============================================================================
// PRISMA SUPPLIER REPOSITORY — Implementation (Infrastructure Layer)
// =============================================================================

import { Injectable, Logger } from '@nestjs/common';
import type { Supplier as PrismaSupplier } from '@prisma/client';

import { Supplier } from '../../domain/entities/supplier.entity.js';
import type {
  ISupplierRepository,
  PaginatedResult,
  SearchSuppliersParams,
} from '../../domain/repositories/supplier.repository.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class PrismaSupplierRepository implements ISupplierRepository {
  private readonly logger = new Logger(PrismaSupplierRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private toDomain(record: PrismaSupplier): Supplier {
    return new Supplier({
      id: record.id,
      name: record.name,
      taxCode: record.taxCode,
      contactName: record.contactName,
      contactPhone: record.contactPhone,
      contactEmail: record.contactEmail,
      paymentTermDays: record.paymentTermDays,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findById(id: string): Promise<Supplier | null> {
    const record = await this.prisma.supplier.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(params: SearchSuppliersParams): Promise<PaginatedResult<Supplier>> {
    const { page, limit, query, isActive } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query) {
      where.name = { contains: query, mode: 'insensitive' };
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [records, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      total,
      page,
      limit,
    };
  }

  async save(supplier: Supplier): Promise<Supplier> {
    const record = await this.prisma.supplier.create({
      data: {
        id: supplier.id,
        name: supplier.name,
        taxCode: supplier.taxCode,
        contactName: supplier.contactName,
        contactPhone: supplier.contactPhone,
        contactEmail: supplier.contactEmail,
        paymentTermDays: supplier.paymentTermDays,
        isActive: supplier.isActive,
      },
    });
    return this.toDomain(record);
  }

  async update(supplier: Supplier): Promise<Supplier> {
    const record = await this.prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        name: supplier.name,
        taxCode: supplier.taxCode,
        contactName: supplier.contactName,
        contactPhone: supplier.contactPhone,
        contactEmail: supplier.contactEmail,
        paymentTermDays: supplier.paymentTermDays,
        isActive: supplier.isActive,
        updatedAt: supplier.updatedAt,
      },
    });
    return this.toDomain(record);
  }
}
