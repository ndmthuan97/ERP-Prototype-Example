// =============================================================================
// API CONFIG — All requests go through API Gateway (single entry point)
// =============================================================================
// Gateway handles JWT verification and routes to correct backend service.
// FE only knows one URL: http://localhost:3010 (gateway).
// Gateway path mapping: /api/auth/* → auth-service, /api/customers/* → customer-service, etc.

export const API_GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY ?? 'http://localhost:3010';

export const API = {
  auth: API_GATEWAY,
  customer: API_GATEWAY,
  sales: API_GATEWAY,
  inventory: API_GATEWAY,
  catalog: API_GATEWAY,
  purchasing: API_GATEWAY,
} as const;

export type ServiceName = keyof typeof API;
