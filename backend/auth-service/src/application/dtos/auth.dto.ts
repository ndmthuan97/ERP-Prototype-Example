// =============================================================================
// AUTH DTOs — Zod validation schemas for auth endpoints
// =============================================================================
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Password-less under B1: admin provisions a user by email + role only; the
// Google/Identity Platform account becomes the credential on first sign-in.
export const registerSchema = z.object({
  email: z.email('Invalid email format'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'manager', 'staff']).optional().default('staff'),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const updateUserSchema = z
  .object({
    role: z.enum(['admin', 'manager', 'staff']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: 'At least one field (role or isActive) is required',
  });

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// SSO callback: the frontend exchanges a Firebase ID token for an app token.
export const ssoCallbackSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export type SsoCallbackDto = z.infer<typeof ssoCallbackSchema>;

// -----------------------------------------------------------------------------
// Swagger DTO classes — bridge the existing Zod schemas above to OpenAPI so that
// @nestjs/swagger renders real request-body schemas. These classes are used ONLY
// as parameter types for @Body() to feed metadata to Swagger; runtime validation
// still happens inside each command via `.parse()` (single source of truth — the
// same Zod schema). `cleanupOpenApiDoc` in main.ts post-processes the document.
// -----------------------------------------------------------------------------
export class RegisterBodyDto extends createZodDto(registerSchema) {}
export class UpdateUserBodyDto extends createZodDto(updateUserSchema) {}
export class SsoCallbackBodyDto extends createZodDto(ssoCallbackSchema) {}
