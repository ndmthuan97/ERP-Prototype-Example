// =============================================================================
// DTOs — Zod validation cho Inventory commands
// =============================================================================
import { z } from 'zod';

const positiveInt = (msg: string) => z.number().int(msg).positive(msg);

export const createItemSchema = z.object({
  sku: z
    .string({ error: 'SKU là bắt buộc' })
    .min(2, 'SKU phải có ít nhất 2 ký tự')
    .max(64, 'SKU tối đa 64 ký tự'),
  name: z
    .string({ error: 'Tên mặt hàng là bắt buộc' })
    .min(2, 'Tên mặt hàng phải có ít nhất 2 ký tự'),
  initialQuantity: z
    .number()
    .int('Số lượng phải là số nguyên')
    .nonnegative('Số lượng không được âm')
    .optional(),
});
export type CreateItemDto = z.infer<typeof createItemSchema>;
export function validateCreateItem(data: unknown): CreateItemDto {
  return createItemSchema.parse(data);
}

export const receiveStockSchema = z.object({
  quantity: positiveInt('Số lượng nhập phải là số nguyên dương'),
});
export type ReceiveStockDto = z.infer<typeof receiveStockSchema>;
export function validateReceiveStock(data: unknown): ReceiveStockDto {
  return receiveStockSchema.parse(data);
}

export const reserveStockSchema = z.object({
  orderId: z
    .string({ error: 'orderId là bắt buộc' })
    .uuid('orderId phải là UUID'),
  quantity: positiveInt('Số lượng giữ chỗ phải là số nguyên dương'),
});
export type ReserveStockDto = z.infer<typeof reserveStockSchema>;
export function validateReserveStock(data: unknown): ReserveStockDto {
  return reserveStockSchema.parse(data);
}

export const releaseStockSchema = z.object({
  orderId: z
    .string({ error: 'orderId là bắt buộc' })
    .uuid('orderId phải là UUID'),
  quantity: positiveInt('Số lượng nhả phải là số nguyên dương'),
});
export type ReleaseStockDto = z.infer<typeof releaseStockSchema>;
export function validateReleaseStock(data: unknown): ReleaseStockDto {
  return releaseStockSchema.parse(data);
}

export const issueStockSchema = z.object({
  quantity: positiveInt('Issue quantity must be a positive integer'),
  reference: z.string().optional(),
  reason: z.string().default('manual_adjust'),
});
export type IssueStockDto = z.infer<typeof issueStockSchema>;
export function validateIssueStock(data: unknown): IssueStockDto {
  return issueStockSchema.parse(data);
}
