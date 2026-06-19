// =============================================================================
// @erp/shared — Barrel export tổng cho toàn bộ code dùng chung
// =============================================================================
// Mọi service import từ '@erp/shared' (1 entrypoint duy nhất):
//   import { EVENT, OutboxWorkerService, withIdempotency, StructuredLogger } from '@erp/shared';

export * from './contracts';
export * from './messaging';
export * from './cache';
export * from './persistence';
export * from './observability';
export * from './config';
