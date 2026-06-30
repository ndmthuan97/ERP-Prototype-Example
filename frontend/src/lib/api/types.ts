// =============================================================================
// API TYPES — khớp shape JSON THẬT của BE (đã verify từ entity + query)
// =============================================================================
// Tiền VND = số nguyên đồng. Date trả về dạng ISO string.

// Customer & Inventory pagination
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Sales pagination — BE uses nested meta structure
export interface PaginatedMeta<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ----- Customer (customer-service :3001) -----
export type CustomerStatus = 'prospect' | 'active' | 'suspended' | 'archived';

export interface Customer {
  id: string;
  businessName: string;
  taxCode: string | null;
  status: CustomerStatus;
  creditLimitAmount: number | null;
  creditUsedAmount: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCustomerInput {
  businessName: string;
  taxCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  /** Số nguyên đồng. Field admin-only trong UI (xem fix C6). */
  creditLimitAmount?: number;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export interface CreditCheck {
  customerId: string;
  creditLimit: number | null;
  creditUsed: number;
  available: number;
  /** ⚠️ available=0 khi unlimited nhưng canOrder=true — đừng suy ra "hết hạn mức" từ available (bug BE M9). */
  canOrder: boolean;
}

// ----- Inventory (inventory-service :3003) -----
export interface StockItem {
  id: string;
  sku: string;
  name: string;
  quantityAvailable: number;
  quantityReserved: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemInput {
  sku: string;
  name: string;
  initialQuantity?: number;
}

export interface Availability {
  sku: string;
  available: number;
  reserved: number;
  total: number;
  canReserve: boolean;
}

// ----- Sales/Order (sales-service :3002) -----
export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'partially_delivered'
  | 'fully_delivered'
  | 'cancelled';

export interface SalesOrderLine {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  status: OrderStatus;
  subtotalAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  cancelReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: SalesOrderLine[];
}

export interface SalesOrderSummary {
  id: string;
  customerId: string;
  status: OrderStatus;
  totalAmount: number;
  lineCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  customerId: string;
}

export interface AddLineInput {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface LifecycleEvent {
  status: string;
  timestamp: string;
  actor: string;
  note: string;
}

export interface LifecycleResponse {
  orderId: string;
  currentStatus: OrderStatus;
  timeline: LifecycleEvent[];
}

export interface SubmitResult {
  id: string;
  status: 'submitted';
  message: string;
}

export interface CancelResult {
  id: string;
  status: 'cancelled';
  cancelReason: string;
  cancelledAt: string;
}

// ----- Delivery Order (sales-service :3002) -----
export type DeliveryStatus =
  | 'draft'
  | 'picking'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'failed';

export interface DeliveryLine {
  id: string;
  salesOrderLineId: string;
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface DeliveryOrder {
  id: string;
  salesOrderId: string;
  status: DeliveryStatus;
  failReason: string | null;
  version: number;
  lines: DeliveryLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeliveryInput {
  lines: Array<{ salesOrderLineId: string; itemId: string; itemName: string; quantity: number }>;
}

// ----- Sales Return (sales-service :3002) -----
export type SalesReturnStatus =
  | 'draft'
  | 'approved'
  | 'goods_received'
  | 'completed'
  | 'rejected';

export interface SalesReturnLine {
  id: string;
  salesOrderLineId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  reason: string | null;
}

export interface SalesReturn {
  id: string;
  salesOrderId: string;
  customerId: string;
  status: SalesReturnStatus;
  reason: string;
  totalRefundAmount: number;
  lines: SalesReturnLine[];
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReturnInput {
  reason: string;
  lines: Array<{ salesOrderLineId: string; itemId: string; itemName: string; quantity: number; unitPrice: number; reason?: string }>;
}

// ----- Supplier (purchasing-service :3004) -----
export interface Supplier {
  id: string;
  name: string;
  taxCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTermDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  taxCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTermDays?: number;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

// ----- Purchase Order Detail (purchasing-service :3004) -----
export interface PurchaseOrderLine {
  id: string;
  productId: string;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export interface PurchaseOrderDetail {
  id: string;
  supplierId: string;
  status: 'draft' | 'placed' | 'partially_received' | 'received' | 'cancelled';
  totalCost: number;
  lines: PurchaseOrderLine[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
}

export interface AddPurchaseOrderLineInput {
  productId: string;
  productName: string;
  orderedQty: number;
  unitCost: number;
}

export interface ReceiveGoodsInput {
  lines: Array<{ lineId: string; quantity: number }>;
}
