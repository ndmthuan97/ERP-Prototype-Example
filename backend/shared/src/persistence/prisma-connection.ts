// =============================================================================
// PRISMA CONNECTION HELPER — Logic kết nối DB dùng chung
// =============================================================================
// Mỗi service có Prisma Client RIÊNG (schema khác nhau) nên KHÔNG thể share
// nguyên PrismaService. Nhưng phần "lấy connection string từ env" thì giống hệt
// → rút helper này lên shared, mỗi service vẫn giữ PrismaService mỏng của mình.
//
// Prisma v7: dùng Driver Adapter (PrismaPg) thay vì url trong schema.prisma.
//   - RUNTIME_DATABASE_URL (port 6543, pooled/PgBouncer) cho app runtime.
//   - Fallback DATABASE_URL (port 5432, direct) nếu chưa set runtime URL.

/**
 * Lấy connection string cho runtime từ environment.
 * Ưu tiên RUNTIME_DATABASE_URL (pooled), fallback DATABASE_URL (direct).
 *
 * @throws Error nếu cả hai đều chưa set — fail fast lúc khởi động.
 */
export function resolveConnectionString(): string {
  const connectionString =
    process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL (hoặc RUNTIME_DATABASE_URL) chưa được set trong environment',
    );
  }

  return connectionString;
}
