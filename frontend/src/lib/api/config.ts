// =============================================================================
// API CONFIG — All requests go through API Gateway (single entry point)
// =============================================================================
// Gateway handles JWT verification and routes to correct backend service.
// FE only knows one URL: http://localhost:3010 (gateway).
// Gateway path mapping: /api/auth/* → auth-service, /api/customers/* → customer-service, etc.

const raw = process.env.NEXT_PUBLIC_API_GATEWAY?.trim();

// Fail the PRODUCTION BUILD (server-side) if unset, so CI catches the misconfig
// instead of the browser silently calling the wrong origin. Guarded to server-side
// (typeof window === 'undefined') to avoid crashing the client bundle at runtime.
if (!raw && process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  throw new Error(
    'NEXT_PUBLIC_API_GATEWAY is required for a production build. Set the GitHub repo variable / --build-arg NEXT_PUBLIC_API_GATEWAY.',
  );
}

// Truthiness fallback (not ??) so an empty string is treated as unset.
export const API_GATEWAY = raw || 'http://localhost:3010';

export const API = {
  auth: API_GATEWAY,
  customer: API_GATEWAY,
  sales: API_GATEWAY,
  inventory: API_GATEWAY,
  catalog: API_GATEWAY,
  purchasing: API_GATEWAY,
} as const;

export type ServiceName = keyof typeof API;
