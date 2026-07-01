// =============================================================================
// ORDER DTOs — Zod validation schemas
// =============================================================================
// Các schema Zod dưới đây được EXPORT để tái dùng trong DTO Swagger (createZodDto)
// — single source of truth: validation runtime vẫn dùng chính schema này qua các
// hàm validateXxx(). Class *BodyDto CHỈ cung cấp metadata cho @nestjs/swagger.
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// --- Create Order ---
export const createOrderSchema = z.object({
  customerId: z.string().uuid('customerId phải là UUID hợp lệ'),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export function validateCreateOrder(data: unknown): CreateOrderDto {
  return createOrderSchema.parse(data);
}
export class CreateOrderBodyDto extends createZodDto(createOrderSchema) {}

// --- Add Line ---
export const addLineSchema = z.object({
  itemId: z.string().uuid('itemId phải là UUID hợp lệ'),
  itemName: z.string().min(1, 'itemName không được rỗng'),
  quantity: z.number().int().positive('quantity phải là số nguyên dương'),
  unitPrice: z.number().positive('unitPrice phải là số dương'),
});
export type AddLineDto = z.infer<typeof addLineSchema>;
export function validateAddLine(data: unknown): AddLineDto {
  return addLineSchema.parse(data);
}
export class AddLineBodyDto extends createZodDto(addLineSchema) {}

// --- Cancel Order ---
export const cancelOrderSchema = z.object({
  reason: z.string().min(5, 'Lý do hủy phải có ít nhất 5 ký tự'),
});
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;
export function validateCancelOrder(data: unknown): CancelOrderDto {
  return cancelOrderSchema.parse(data);
}
export class CancelOrderBodyDto extends createZodDto(cancelOrderSchema) {}

// --- Search Orders ---
const validStatuses = [
  'draft',
  'submitted',
  'confirmed',
  'partially_delivered',
  'fully_delivered',
  'cancelled',
];
const searchOrdersSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  status: z
    .string()
    .refine((s) => validStatuses.includes(s), {
      message: `status phải là: ${validStatuses.join(', ')}`,
    })
    .optional(),
});
export type SearchOrdersDto = z.infer<typeof searchOrdersSchema>;
export function validateSearchOrders(data: unknown): SearchOrdersDto {
  return searchOrdersSchema.parse(data);
}
