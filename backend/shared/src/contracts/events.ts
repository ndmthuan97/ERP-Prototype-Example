// =============================================================================
// EVENT CONTRACTS — "Hợp đồng" event dùng chung giữa các bounded context
// =============================================================================
// Đây là Shared Kernel (DDD): phần model mà nhiều service ĐỒNG Ý dùng chung.
//
// Tại sao tách ra đây thay vì hardcode 'customer.created' trong mỗi service?
// - Single source of truth: đổi tên topic 1 chỗ → tất cả producer/consumer cùng cập nhật.
// - Type-safe: payload có interface rõ ràng → gõ sai field là compile error,
//   không còn cảnh Order publish 1 kiểu mà Inventory đọc 1 kiểu khác.

/**
 * Tên event = tên Pub/Sub topic. Dùng `as const` để TypeScript suy ra
 * literal type (vd: 'customer.created') thay vì string chung chung.
 */
export const EVENT = {
  // --- Customer context ---
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',

  // --- Sales context ---
  SALES_ORDER_SUBMITTED: 'sales-order.submitted',
  SALES_ORDER_CONFIRMED: 'sales-order.confirmed',
  SALES_ORDER_FULFILLED: 'sales-order.fulfilled',
  SALES_ORDER_CANCELLED: 'sales-order.cancelled',

  // --- Catalog context ---
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DEACTIVATED: 'product.deactivated',
  PRODUCT_ACTIVATED: 'product.activated',

  // --- Inventory context ---
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RESERVATION_FAILED: 'inventory.reservation-failed',
  INVENTORY_RELEASED: 'inventory.released',
  INVENTORY_ISSUED: 'inventory.issued',

  // --- Purchasing context ---
  PURCHASE_ORDER_PLACED: 'purchase-order.placed',
  PURCHASE_ORDER_CANCELLED: 'purchase-order.cancelled',
  GOODS_RECEIVED: 'goods.received',
} as const;

/** Union của tất cả tên event hợp lệ — dùng làm kiểu cho tham số eventType */
export type EventType = (typeof EVENT)[keyof typeof EVENT];

/**
 * Metadata đính kèm MỌI event để truy vết (observability).
 * correlationId cho phép `grep` 1 lệnh thấy cả vòng đời saga xuyên 4 service.
 */
export interface EventMetadata {
  /** ID truy vết — giữ nguyên xuyên suốt 1 luồng nghiệp vụ (vd: 1 order) */
  correlationId?: string;
  /** ID duy nhất của event — dùng cho idempotency dedup ở consumer */
  eventId?: string;
  /** Thời điểm event xảy ra (ISO string) */
  occurredAt?: string;
}

/** Phiên bản envelope hiện tại — tăng khi đổi cấu trúc envelope (breaking). */
export const EVENT_ENVELOPE_VERSION = 1;

/**
 * Envelope CHUẨN bọc mọi message publish lên Pub/Sub.
 *
 * Vì sao cần envelope (thay vì publish payload trần)?
 * - `eventId` (= id dòng outbox) là KHOÁ DEDUP ổn định cho Idempotent Consumer:
 *   outbox at-least-once có thể publish cùng 1 dòng >1 lần → consumer dedup theo eventId.
 *   (Pub/Sub messageId KHÔNG đủ: mỗi lần re-publish sinh messageId mới.)
 * - `eventVersion` cho phép tiến hoá schema mà consumer cũ vẫn xử lý được.
 * - `correlationId` truy vết xuyên service; `occurredAt` thời điểm phát.
 *
 * Các trường khoá (eventId, eventType, correlationId) cũng được gắn vào Pub/Sub
 * message attributes để consumer dedup/route mà không cần parse body.
 */
export interface EventEnvelope<T = unknown> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  correlationId: string | null;
  payload: T;
}

// ---- Payload contracts cho từng event ----
// Tiền tệ truyền dưới dạng string để không mất chính xác (Decimal → string).

export interface CustomerCreatedPayload {
  id: string;
  businessName: string;
  taxCode: string | null;
  status: string;
  creditLimitAmount: string | null;
  creditUsedAmount: string;
  _meta?: EventMetadata;
}

export type CustomerUpdatedPayload = CustomerCreatedPayload;

export interface CustomerDeletedPayload {
  id: string;
  businessName: string;
  deletedAt: string | null;
  _meta?: EventMetadata;
}

export interface ProductCreatedPayload {
  id: string;
  sku: string;
  name: string;
  unit: string;
  defaultSalePrice: string;
  isActive: boolean;
  _meta?: EventMetadata;
}

export type ProductUpdatedPayload = ProductCreatedPayload;

export interface ProductDeactivatedPayload {
  id: string;
  sku: string;
  name: string;
  _meta?: EventMetadata;
}

export type ProductActivatedPayload = ProductDeactivatedPayload;

export interface SalesOrderLineRef {
  itemId: string;
  quantity: number;
}

export interface SalesOrderSubmittedPayload {
  orderId: string;
  customerId: string;
  totalAmount: number;
  lines: SalesOrderLineRef[];
  _meta?: EventMetadata;
}

export interface SalesOrderConfirmedPayload {
  orderId: string;
  _meta?: EventMetadata;
}

export interface SalesOrderFulfilledPayload {
  orderId: string;
  customerId: string;
  lines: SalesOrderLineRef[];
  _meta?: EventMetadata;
}

export interface SalesOrderCancelledPayload {
  orderId: string;
  reason: string;
  /** Line items for inventory compensation (release reserved stock) */
  lines: SalesOrderLineRef[];
  _meta?: EventMetadata;
}

export interface InventoryReservedPayload {
  orderId: string;
  reservationId: string;
  _meta?: EventMetadata;
}

export interface InventoryReservationFailedPayload {
  orderId: string;
  reason: string;
  _meta?: EventMetadata;
}

export interface InventoryReleasedPayload {
  orderId: string;
  reservationId: string;
  _meta?: EventMetadata;
}

export interface InventoryIssuedPayload {
  sku: string;
  quantity: number;
  reason: string;
  reference?: string;
  _meta?: EventMetadata;
}

export interface PurchaseOrderPlacedPayload {
  orderId: string;
  supplierId: string;
  totalCost: number;
  lineCount: number;
  _meta?: EventMetadata;
}

export interface PurchaseOrderCancelledPayload {
  orderId: string;
  reason: string | null;
  _meta?: EventMetadata;
}

export interface GoodsReceivedReceiptRef {
  lineId: string;
  productId: string;
  sku: string;
  quantity: number;
}

export interface GoodsReceivedPayload {
  orderId: string;
  supplierId: string;
  receipts: GoodsReceivedReceiptRef[];
  newStatus: string;
  _meta?: EventMetadata;
}
