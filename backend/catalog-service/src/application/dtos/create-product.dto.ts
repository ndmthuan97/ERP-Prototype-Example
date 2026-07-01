// =============================================================================
// CREATE PRODUCT DTO — Zod validation schema
// =============================================================================

import { z } from "zod";

export const createProductSchema = z.object({
  sku: z
    .string({ error: "SKU is required" })
    .min(3, "SKU must be at least 3 characters")
    .max(30, "SKU must be at most 30 characters"),

  name: z
    .string({ error: "Product name is required" })
    .min(1, "Product name must not be empty"),

  unit: z.string().optional(),

  defaultSalePrice: z
    .number({ error: "Default sale price must be a number" })
    .min(0, "Default sale price must be >= 0")
    .optional()
    .default(0),

  taxRate: z
    .number({ error: "Tax rate must be a number" })
    .refine(
      (v) => [0, 0.05, 0.08, 0.1].includes(v),
      "Tax rate must be one of: 0%, 5%, 8%, 10%",
    )
    .optional(),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;

export function validateCreateProduct(data: unknown): CreateProductDto {
  return createProductSchema.parse(data);
}
