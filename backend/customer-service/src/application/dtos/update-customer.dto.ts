// =============================================================================
// UPDATE CUSTOMER DTO — Validation schema cho cập nhật khách hàng
// =============================================================================
// Khác với CreateCustomerDto:
// - id là bắt buộc (xác định khách hàng cần cập nhật)
// - Tất cả field khác đều optional (partial update)
//
// Partial update nghĩa là client chỉ gửi các field cần thay đổi,
// không bắt buộc gửi lại toàn bộ dữ liệu.

import { z } from 'zod';
import { TaxCode } from '../../domain/value-objects/index.js';

/**
 * Zod schema cho request cập nhật khách hàng.
 *
 * Chỉ có id là bắt buộc — các field còn lại đều optional.
 * Nếu field không được gửi → giữ nguyên giá trị cũ (không set null).
 */
export const updateCustomerSchema = z.object({
  // ID khách hàng — bắt buộc, dùng UUID format
  id: z.string({ error: 'ID khách hàng là bắt buộc' }).uuid('ID phải là UUID hợp lệ'),

  // Tên doanh nghiệp — optional, nếu có phải >= 2 ký tự
  businessName: z
    .string()
    .min(2, 'Tên doanh nghiệp phải có ít nhất 2 ký tự')
    .optional(),

  // Mã số thuế — optional, validate bằng TaxCode VO nếu có giá trị
  taxCode: z
    .string()
    .optional()
    .refine(
      (value) => !value || TaxCode.isValid(value),
      { message: 'Mã số thuế không đúng định dạng (VD: 0312345678 hoặc 0312345678-001)' },
    ),

  // Các field liên hệ — tất cả optional
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email('Email không đúng định dạng').optional(),

  // Hạn mức tín dụng — optional, phải dương nếu có
  creditLimitAmount: z
    .number()
    .positive('Hạn mức tín dụng phải là số dương')
    .optional(),
});

/**
 * Type inferred tự động từ Zod schema.
 * id: string (required), tất cả field khác optional.
 */
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

/**
 * Validate dữ liệu cập nhật.
 * @param data - Dữ liệu thô từ request body + param
 * @returns Dữ liệu đã validate
 */
export function validateUpdateCustomer(data: unknown): UpdateCustomerDto {
  return updateCustomerSchema.parse(data);
}
