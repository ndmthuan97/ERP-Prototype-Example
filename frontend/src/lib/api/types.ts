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
  | 'fulfilled'
  | 'cancelled';

export interface SalesOrderLine {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  status: OrderStatus;
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
