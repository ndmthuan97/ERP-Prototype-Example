// =============================================================================
// UPDATE PRODUCT DTO — Zod validation schema (partial update)
// =============================================================================

import { z } from "zod";

export const updateProductSchema = z.object({
  id: z.string({ error: "Product ID is required" }),

  name: z.string().min(1, "Product name must not be empty").optional(),

  unit: z.string().min(1, "Unit must not be empty").optional(),

  defaultSalePrice: z
    .number()
    .min(0, "Default sale price must be >= 0")
    .optional(),
});

export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export function validateUpdateProduct(data: unknown): UpdateProductDto {
  return updateProductSchema.parse(data);
}
