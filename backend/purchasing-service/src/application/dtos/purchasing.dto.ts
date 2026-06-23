// =============================================================================
// PURCHASING DTOs — Zod validation schemas for all inputs
// =============================================================================
import { z } from 'zod';

// --- CreatePO ---
export const createPOSchema = z.object({
  supplierId: z
    .string({ error: 'supplierId is required' })
    .min(1, 'supplierId must not be empty'),
});
export type CreatePODto = z.infer<typeof createPOSchema>;
export function validateCreatePO(data: unknown): CreatePODto {
  return createPOSchema.parse(data);
}

// --- AddLinePO ---
export const addLinePOSchema = z.object({
  productId: z
    .string({ error: 'productId is required' })
    .min(1, 'productId must not be empty'),
  productName: z
    .string({ error: 'productName is required' })
    .min(1, 'productName must not be empty'),
  orderedQty: z
    .number({ error: 'orderedQty must be a number' })
    .int('orderedQty must be an integer')
    .positive('orderedQty must be positive'),
  unitCost: z
    .number({ error: 'unitCost must be a number' })
    .positive('unitCost must be positive'),
});
export type AddLinePODto = z.infer<typeof addLinePOSchema>;
export function validateAddLinePO(data: unknown): AddLinePODto {
  return addLinePOSchema.parse(data);
}

// --- ReceiveGoods ---
const receiptItemSchema = z.object({
  lineId: z.string().min(1, 'lineId must not be empty'),
  quantity: z
    .number()
    .int('quantity must be an integer')
    .positive('quantity must be positive'),
});

export const receiveGoodsSchema = z.object({
  receipts: z
    .array(receiptItemSchema)
    .min(1, 'At least one receipt is required'),
});
export type ReceiveGoodsDto = z.infer<typeof receiveGoodsSchema>;
export function validateReceiveGoods(data: unknown): ReceiveGoodsDto {
  return receiveGoodsSchema.parse(data);
}

// --- CancelPO ---
export const cancelPOSchema = z.object({
  reason: z.string().optional(),
});
export type CancelPODto = z.infer<typeof cancelPOSchema>;
export function validateCancelPO(data: unknown): CancelPODto {
  return cancelPOSchema.parse(data);
}

// --- SearchPOs ---
export const searchPOsSchema = z.object({
  status: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});
export type SearchPOsDto = z.infer<typeof searchPOsSchema>;
