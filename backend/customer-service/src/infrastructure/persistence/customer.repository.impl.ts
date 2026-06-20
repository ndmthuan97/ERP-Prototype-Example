// =============================================================================
// PRISMA CUSTOMER REPOSITORY — Implementation của ICustomerRepository
// =============================================================================
// Đây là "adapter" trong kiến trúc Hexagonal:
// - Port (interface):    ICustomerRepository ở domain layer
// - Adapter (implement): PrismaCustomerRepository ở infrastructure layer
//
// Class này chịu trách nhiệm:
// 1. Chuyển đổi giữa Prisma model (DB) ↔ Domain entity (toDomain / toPrisma)
// 2. Thực hiện CRUD operations qua PrismaService
// 3. Ghi outbox event trong cùng transaction với business data (Outbox Pattern)
//
// Tuân thủ Liskov Substitution: có thể thay thế bằng bất kỳ implementation nào
// khác (InMemory, MongoDB...) mà application layer không cần thay đổi.

import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { Customer, CustomerStatus } from '../../domain/entities/index.js';
import type {
  ICustomerRepository,
  PaginatedResult,
} from '../../domain/repositories/index.js';
import { PrismaService } from './prisma.service.js';
// Event names typed + correlationId để truy vết — dùng chung từ @erp/shared
import { EVENT, getCorrelationId } from '@erp/shared';

/** Tạo metadata truy vết đính kèm mọi event (correlationId xuyên saga) */
function buildEventMeta() {
  return {
    correlationId: getCorrelationId() ?? null,
    occurredAt: new Date().toISOString(),
  };
}

// ---- Type alias cho Prisma model — tránh lặp lại kiểu dài dòng ----

/** Type đại diện cho bản ghi CustomerCore từ database */
type CustomerRecord = {
  id: string;
  businessName: string;
  taxCode: string | null;
  status: string;
  creditLimitAmount: Prisma.Decimal | null;
  creditUsedAmount: Prisma.Decimal;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

@Injectable()
export class PrismaCustomerRepository implements ICustomerRepository {
  private readonly logger = new Logger(PrismaCustomerRepository.name);

  /**
   * Inject PrismaService — kết nối DB duy nhất toàn app.
   * Không inject trực tiếp PrismaClient vì PrismaService có thêm lifecycle hooks.
   */
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // MAPPING METHODS — Chuyển đổi giữa DB record và Domain entity
  // ==========================================================================
  // Tách mapping ra method riêng để:
  // 1. Tránh lặp code (DRY) — tất cả query đều dùng chung mapping
  // 2. Dễ maintain khi schema thay đổi — chỉ sửa 1 chỗ
  // 3. Đảm bảo Prisma Decimal → number conversion nhất quán

  /**
   * Chuyển bản ghi DB (Prisma model) → Domain Entity.
   * Prisma.Decimal cần chuyển sang number vì domain layer dùng number thuần.
   * toNumber() là method có sẵn của Prisma.Decimal.
   */
  private toDomain(record: CustomerRecord): Customer {
    return new Customer({
      id: record.id,
      businessName: record.businessName,
      taxCode: record.taxCode,
      // Cast string từ DB về CustomerStatus — DB lưu string, domain dùng union type
      status: record.status as CustomerStatus,
      // Prisma.Decimal → số nguyên đồng (Math.round phòng dữ liệu lẻ cũ), null giữ null.
      // Tiền VND luôn là số nguyên; làm tròn để tránh artifact dấu phẩy động.
      creditLimitAmount: record.creditLimitAmount
        ? Math.round(record.creditLimitAmount.toNumber())
        : null,
      creditUsedAmount: Math.round(record.creditUsedAmount.toNumber()),
      contactName: record.contactName,
      contactPhone: record.contactPhone,
      contactEmail: record.contactEmail,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    });
  }

  /**
   * Chuyển Domain Entity → Prisma input data cho create/update.
   * Trả về object phẳng phù hợp với Prisma's create/update API.
   * Không bao gồm id vì upsert dùng id riêng ở where clause.
   */
  private toPrismaData(customer: Customer) {
    return {
      businessName: customer.businessName,
      taxCode: customer.taxCode,
      status: customer.status,
      creditLimitAmount: customer.creditLimitAmount,
      creditUsedAmount: customer.creditUsedAmount,
      contactName: customer.contactName,
      contactPhone: customer.contactPhone,
      contactEmail: customer.contactEmail,
      deletedAt: customer.deletedAt,
    };
  }

  // ==========================================================================
  // QUERY METHODS — Đọc dữ liệu từ database
  // ==========================================================================

  /**
   * Tìm khách hàng theo ID, chỉ trả về bản ghi chưa bị soft delete.
   * Điều kiện: deletedAt IS NULL — khách hàng đã archived sẽ không tìm thấy.
   */
  async findById(id: string): Promise<Customer | null> {
    const record = await this.prisma.customerCore.findFirst({
      where: {
        id,
        // Chỉ lấy bản ghi chưa bị soft delete
        deletedAt: null,
      },
    });

    // Không tìm thấy → trả null, để application layer quyết định throw hay không
    if (!record) return null;

    return this.toDomain(record);
  }

  /**
   * Tìm khách hàng theo mã số thuế (kể cả bản ghi đã archived).
   * Dùng để kiểm tra trùng lặp trước khi tạo mới.
   *
   * MST là @unique TOÀN CỤC ở DB (1 pháp nhân = 1 MST, kể cả khi đã archived).
   * Vì vậy KHÔNG filter deletedAt — để check ở application layer khớp với ràng buộc
   * DB, tránh trường hợp app báo "OK" nhưng DB ném P2002.
   */
  async findByTaxCode(taxCode: string): Promise<Customer | null> {
    const record = await this.prisma.customerCore.findUnique({
      where: { taxCode },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  /**
   * Tìm kiếm khách hàng theo từ khóa với phân trang.
   *
   * Chiến lược tìm kiếm:
   * - Dùng `contains` mode `insensitive` để ILIKE trên businessName
   * - Chỉ tìm bản ghi chưa soft delete
   * - Sắp xếp theo createdAt DESC (mới nhất lên trước)
   *
   * Phân trang:
   * - page 1-indexed → skip = (page - 1) * limit
   * - Chạy song song count + findMany để tối ưu performance
   */
  async search(
    query: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Customer>> {
    // Điều kiện where dùng chung cho cả count và findMany — DRY
    const whereCondition: Prisma.CustomerCoreWhereInput = {
      deletedAt: null,
      // Nếu query rỗng → bỏ qua filter businessName, trả về tất cả
      ...(query && {
        businessName: {
          contains: query,
          mode: 'insensitive' as const,
        },
      }),
    };

    // Tính offset từ page (1-indexed) sang skip (0-indexed)
    const skip = (page - 1) * limit;

    // Chạy song song 2 query: đếm tổng + lấy dữ liệu trang hiện tại
    // Promise.all giúp tiết kiệm thời gian thay vì chạy tuần tự
    const [total, records] = await Promise.all([
      this.prisma.customerCore.count({ where: whereCondition }),
      this.prisma.customerCore.findMany({
        where: whereCondition,
        skip,
        take: limit,
        // Sắp xếp mới nhất lên trước — phù hợp UX danh sách
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: records.map((record) => this.toDomain(record)),
      total,
      page,
      limit,
    };
  }

  // ==========================================================================
  // MUTATION METHODS — Ghi dữ liệu vào database
  // ==========================================================================
  // Tất cả mutation đều dùng $transaction để đảm bảo atomicity:
  // Business data + Outbox event được ghi CÙNG LÚC hoặc CÙNG ROLLBACK.

  /**
   * Lưu (tạo mới hoặc cập nhật) khách hàng.
   *
   * Sử dụng upsert pattern:
   * - Nếu ID đã tồn tại trong DB → UPDATE với dữ liệu mới
   * - Nếu ID chưa có → CREATE bản ghi mới
   *
   * Outbox Pattern:
   * Trong cùng transaction, ghi 1 event vào bảng outbox.
   * Worker riêng sẽ poll outbox và publish lên Pub/Sub.
   * Đảm bảo event LUÔN được ghi nếu business data được ghi thành công.
   */
  async save(customer: Customer): Promise<Customer> {
    const prismaData = this.toPrismaData(customer);

    try {
      // Transaction đảm bảo upsert + outbox ghi cùng lúc (all-or-nothing).
      // Kiểm tra tồn tại NẰM TRONG transaction → tránh TOCTOU + bớt 1 round-trip.
      const { record, isCreating } = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.customerCore.findUnique({
            where: { id: customer.id },
          });
          const creating = !existing;
          const eventType = creating
            ? EVENT.CUSTOMER_CREATED
            : EVENT.CUSTOMER_UPDATED;

          // Upsert: tạo mới nếu chưa có, cập nhật nếu đã tồn tại
          const upsertedRecord = await tx.customerCore.upsert({
            where: { id: customer.id },
            // Dữ liệu khi CREATE — bao gồm cả id
            create: {
              id: customer.id,
              ...prismaData,
            },
            // Dữ liệu khi UPDATE — không bao gồm id (immutable)
            update: prismaData,
          });

          // Ghi outbox event — worker sẽ publish lên Pub/Sub sau
          await tx.outbox.create({
            data: {
              id: uuidv4(),
              aggregateType: 'Customer',
              aggregateId: customer.id,
              eventType,
              // Payload chứa toàn bộ state hiện tại của entity
              // Downstream consumers sẽ dùng payload này để xử lý
              payload: {
                id: upsertedRecord.id,
                businessName: upsertedRecord.businessName,
                taxCode: upsertedRecord.taxCode,
                status: upsertedRecord.status,
                creditLimitAmount:
                  upsertedRecord.creditLimitAmount?.toString() ?? null,
                creditUsedAmount: upsertedRecord.creditUsedAmount.toString(),
                // Metadata truy vết — correlationId để grep cả vòng đời xuyên service
                _meta: buildEventMeta(),
              },
            },
          });

          return { record: upsertedRecord, isCreating: creating };
        },
      );

      this.logger.log(
        `Customer ${isCreating ? EVENT.CUSTOMER_CREATED : EVENT.CUSTOMER_UPDATED}: ` +
          `id=${record.id}, name="${record.businessName}"`,
      );

      return this.toDomain(record);
    } catch (error) {
      // Trùng MST (unique violation P2002) — kể cả khi check ở application miss
      // do race condition giữa 2 request đồng thời. DB là chốt chặn cuối.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Mã số thuế "${customer.taxCode ?? ''}" đã được sử dụng bởi khách hàng khác`,
        );
      }
      throw error;
    }
  }

  /**
   * Soft delete khách hàng.
   *
   * Không xóa vật lý (DELETE FROM) mà chỉ:
   * 1. Gọi customer.archive() ở application layer (set status=archived, deletedAt=now)
   * 2. UPDATE bản ghi trong DB
   * 3. Ghi outbox event "customer.deleted"
   *
   * Tất cả trong cùng transaction để đảm bảo tính nhất quán.
   */
  async delete(customer: Customer): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Update bản ghi: set status=archived, deletedAt=now
      await tx.customerCore.update({
        where: { id: customer.id },
        data: {
          status: customer.status,
          deletedAt: customer.deletedAt,
          updatedAt: customer.updatedAt,
        },
      });

      // Ghi outbox event "customer.deleted"
      await tx.outbox.create({
        data: {
          id: uuidv4(),
          aggregateType: 'Customer',
          aggregateId: customer.id,
          eventType: EVENT.CUSTOMER_DELETED,
          payload: {
            id: customer.id,
            businessName: customer.businessName,
            deletedAt: customer.deletedAt?.toISOString() ?? null,
            _meta: buildEventMeta(),
          },
        },
      });
    });

    this.logger.log(
      `Customer soft-deleted: id=${customer.id}, name="${customer.businessName}"`,
    );
  }
}
