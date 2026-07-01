// =============================================================================
// CREATE CUSTOMER DTO — Validation schema dùng Zod
// =============================================================================
// Trong kiến trúc DDD, DTO (Data Transfer Object) nằm ở application layer.
// DTO chịu trách nhiệm:
// 1. Định nghĩa shape dữ liệu đầu vào từ client (request body)
// 2. Validate dữ liệu trước khi chuyển cho domain layer xử lý
//
// Sử dụng Zod thay vì class-validator vì:
// - Type inference tự động (không cần khai báo interface riêng)
// - Runtime validation + compile-time type safety
// - Schema composable và testable
// - Nhẹ hơn class-validator + class-transformer combo

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { TaxCode } from '../../domain/value-objects/index.js';

/**
 * Zod schema cho request tạo mới khách hàng.
 *
 * Mỗi field có validation rule rõ ràng:
 * - businessName: bắt buộc, tối thiểu 2 ký tự (tránh tên quá ngắn / rỗng)
 * - taxCode: tùy chọn, nếu có phải đúng format MST Việt Nam
 * - contactName/Phone/Email: tùy chọn, string thường
 * - creditLimitAmount: tùy chọn, phải là số dương nếu có
 */
export const createCustomerSchema = z.object({
  // Tên doanh nghiệp — bắt buộc, >= 2 ký tự
  businessName: z
    .string({ error: 'Tên doanh nghiệp là bắt buộc' })
    .min(2, 'Tên doanh nghiệp phải có ít nhất 2 ký tự'),

  // Mã số thuế — tùy chọn, validate bằng TaxCode Value Object
  // .refine() cho phép sử dụng custom validation logic từ domain layer
  taxCode: z
    .string()
    .optional()
    .refine(
      // Nếu giá trị undefined/null → bỏ qua (optional), nếu có → phải hợp lệ
      (value) => !value || TaxCode.isValid(value),
      {
        message:
          'Mã số thuế không đúng định dạng (VD: 0312345678 hoặc 0312345678-001)',
      },
    ),

  // Tên người liên hệ — tùy chọn
  contactName: z.string().optional(),

  // Số điện thoại — tùy chọn
  contactPhone: z.string().optional(),

  // Email — tùy chọn, nếu có phải đúng format email
  contactEmail: z.string().email('Email không đúng định dạng').optional(),

  // Hạn mức tín dụng — tùy chọn. Tiền VND tính bằng ĐỒNG (số nguyên), không phần
  // lẻ → ép .int() để tránh sai số dấu phẩy động (float drift) khi tính toán tín dụng.
  creditLimitAmount: z
    .number()
    .int('Hạn mức tín dụng phải là số nguyên (đơn vị: đồng)')
    .positive('Hạn mức tín dụng phải là số dương')
    .optional(),
});

/**
 * Type CreateCustomerDto — inferred tự động từ Zod schema.
 * Không cần khai báo interface riêng — Zod tự sinh type chính xác.
 * Type này dùng trong command và controller để type-safe.
 */
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

/**
 * Validate dữ liệu đầu vào theo schema.
 * Trả về parsed data (đã clean/transform) nếu hợp lệ.
 * Throw ZodError nếu không hợp lệ — controller sẽ catch và trả 400.
 *
 * @param data - Dữ liệu thô từ request body
 * @returns Dữ liệu đã validate và parse
 */
export function validateCreateCustomer(data: unknown): CreateCustomerDto {
  return createCustomerSchema.parse(data);
}

/**
 * Swagger DTO class — bắc cầu Zod schema ở trên sang OpenAPI để @nestjs/swagger
 * render body schema thật. Class này CHỈ dùng làm kiểu tham số cho @Body() nhằm
 * cung cấp metadata cho Swagger; validation runtime vẫn do command gọi
 * `createCustomerSchema.parse()` đảm nhiệm (single source of truth — cùng schema).
 */
export class CreateCustomerBodyDto extends createZodDto(createCustomerSchema) {}
