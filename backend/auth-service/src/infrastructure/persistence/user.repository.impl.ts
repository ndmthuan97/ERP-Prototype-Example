// =============================================================================
// PRISMA USER REPOSITORY — Infrastructure implementation of IUserRepository
// =============================================================================
import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { User, type UserRole } from '../../domain/entities/user.entity.js';
import type {
  IUserRepository,
  PaginatedResult,
} from '../../domain/repositories/user.repository.js';

// Prisma generated type for the User model
type PrismaUser = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Map a Prisma record to a domain User entity */
  private toDomain(record: PrismaUser): User {
    return new User({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      fullName: record.fullName,
      role: record.role as UserRole,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    return record ? this.toDomain(record) : null;
  }

  async findAll(page: number, limit: number): Promise<PaginatedResult<User>> {
    const [records, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      total,
      page,
      limit,
    };
  }

  async save(user: User): Promise<User> {
    const data = {
      email: user.email,
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    };

    const record = await this.prisma.user.upsert({
      where: { id: user.id },
      create: { id: user.id, ...data },
      update: data,
    });

    return this.toDomain(record);
  }
}
