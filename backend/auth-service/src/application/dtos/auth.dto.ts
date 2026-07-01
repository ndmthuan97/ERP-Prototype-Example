// =============================================================================
// AUTH DTOs — Zod validation schemas for auth endpoints
// =============================================================================
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const registerSchema = z.object({
  email: z.email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'manager', 'staff']).optional().default('staff'),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshDto = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LogoutDto = z.infer<typeof logoutSchema>;

// -----------------------------------------------------------------------------
// Swagger DTO classes — bridge the existing Zod schemas above to OpenAPI so that
// @nestjs/swagger renders real request-body schemas. These classes are used ONLY
// as parameter types for @Body() to feed metadata to Swagger; runtime validation
// still happens inside each command via `.parse()` (single source of truth — the
// same Zod schema). `cleanupOpenApiDoc` in main.ts post-processes the document.
// -----------------------------------------------------------------------------
export class RegisterBodyDto extends createZodDto(registerSchema) {}
export class LoginBodyDto extends createZodDto(loginSchema) {}
export class RefreshBodyDto extends createZodDto(refreshSchema) {}
export class LogoutBodyDto extends createZodDto(logoutSchema) {}
