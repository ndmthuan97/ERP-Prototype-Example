---
type: Runbook
title: "Implementation Plan — Domain Enhancement"
description: "Step-by-step implementation plan for ERP domain enhancements across 6 phases with ~30+ file changes"
tags: [runbook, implementation, upgrade, domain]
timestamp: "2026-06-25T00:00:00+07:00"
---

# 📋 Implementation Plan — ERP Domain Enhancement

> **Nguồn**: [domain-gap-analysis.md](./domain-gap-analysis.md)  
> **Tổng effort**: ~15-25 giờ | 6 phases | ~30+ files thay đổi  

---

## Phase 0: Quick Fixes — Sửa 3 bugs nghiệp vụ (1-2h)

### 0.1. Cho phép unitPrice = 0 (hàng tặng)

#### [MODIFY] `sales-service/src/domain/entities/sales-order-line.entity.ts`
```diff
-    if (unitPrice <= 0) {
-      throw new Error('Đơn giá phải là số dương');
+    if (unitPrice < 0) {
+      throw new Error('Đơn giá không được âm');
```

#### [MODIFY] `sales-service/src/domain/entities/sales-order-line.entity.spec.ts`
- Thêm test: `should allow unitPrice = 0 (free/promotional item)`
- Sửa test: expect error chỉ khi `unitPrice < 0`

---

### 0.2. Cho phép decimal quantity (kg, lít, mét)

#### [MODIFY] `sales-service/src/domain/entities/sales-order-line.entity.ts`
```diff
-    if (!Number.isInteger(quantity) || quantity <= 0) {
-      throw new Error('Số lượng phải là số nguyên dương');
+    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
+      throw new Error('Quantity must be a positive number');
```

#### [MODIFY] `inventory-service/src/domain/entities/stock-item.entity.ts`
```diff
  private assertPositive(quantity: number): void {
-    if (!Number.isInteger(quantity) || quantity <= 0) {
-      throw new Error('Số lượng phải là số nguyên dương');
+    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
+      throw new Error('Quantity must be a positive number');
```

#### [MODIFY] `purchasing-service/src/domain/entities/purchase-order-line.entity.ts`
```diff
-    if (!Number.isInteger(orderedQty) || orderedQty <= 0) {
-      throw new Error('orderedQty must be a positive integer');
+    if (typeof orderedQty !== 'number' || !Number.isFinite(orderedQty) || orderedQty <= 0) {
+      throw new Error('orderedQty must be a positive number');
```

#### Prisma schema changes (3 files)

| Schema | Column | Change |
|---|---|---|
| `sales-service/prisma/schema.prisma` L56 | `quantity` | `Int` → `Decimal @db.Decimal(18, 4)` |
| `inventory-service/prisma/schema.prisma` L30-33 | `quantityAvailable`, `quantityReserved` | `Int` → `Decimal @db.Decimal(18, 4)` |
| `inventory-service/prisma/schema.prisma` L56 | `StockMovement.quantity` | `Int` → `Decimal @db.Decimal(18, 4)` |
| `purchasing-service/prisma/schema.prisma` L51-52 | `orderedQty`, `receivedQty` | `Int` → `Decimal @db.Decimal(18, 4)` |

> **⚠️ WARNING**: Thay đổi Int → Decimal sẽ ảnh hưởng repository layer (Prisma trả Decimal object thay vì number). Cần `Number()` conversion ở mapper/repository.

#### Tests cần update
- `inventory-service/src/domain/entities/stock-item.entity.spec.ts` — sửa test integer-only
- `sales-service/src/domain/entities/sales-order-line.entity.spec.ts` — thêm test decimal
- `inventory-service/src/application/commands/stock-ops.command.spec.ts`

---

### 0.3. Credit check tính thêm pending SOs

#### [MODIFY] `customer-service/src/application/queries/check-credit.query.ts`

Thêm parameter `orderAmount` vào `execute()` + thêm `pendingOrdersTotal` vào response:

```diff
+ export interface CreditCheckRequest {
+   customerId: string;
+   orderAmount: number;        // Amount of the new order being checked
+   pendingOrdersTotal?: number; // Sum of submitted-but-not-confirmed SOs (caller provides)
+ }
+
  export interface CreditCheckResult {
    customerId: string;
    creditLimit: number | null;
    creditUsed: number;
+   pendingAmount: number;      // Amount tied up in pending orders
    available: number;
    canOrder: boolean;
  }
```

> **❗ IMPORTANT — Design decision**: Credit check nhận `pendingOrdersTotal` từ caller (sales-service) vì customer-service KHÔNG nên query sang sales-service DB (vi phạm bounded context). Sales-service tính `SUM(totalAmount) WHERE status = 'submitted'` rồi gửi kèm request.

#### [MODIFY] `sales-service/src/application/commands/handle-inventory-reserved.command.ts`
- Trước khi gọi `customerClient.checkCredit()`, query tổng `SUM(totalAmount)` của các SO đang submitted (trừ SO hiện tại)
- Truyền `pendingOrdersTotal` vào credit check

#### [MODIFY] `sales-service/src/infrastructure/http/customer-client.ts`
- Thêm `pendingOrdersTotal` vào HTTP request params

---

## Phase 1: Supplier Entity (2-4h)

### Trong purchasing-service

#### [NEW] `purchasing-service/src/domain/entities/supplier.entity.ts`
```
Supplier {
  id: string (UUID)
  name: string
  taxCode: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  paymentTermDays: number (default: 30)
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

Methods:
  - activate(): void
  - deactivate(): void
  - update(changes): void
  - static create(id, name, ...): Supplier
```

#### [NEW] `purchasing-service/src/domain/repositories/supplier.repository.ts`
- Interface `ISupplierRepository` + injection token `SUPPLIER_REPOSITORY`
- Methods: `findById`, `findAll`, `save`, `update`

#### [NEW] `purchasing-service/src/infrastructure/repositories/prisma-supplier.repository.ts`
- Prisma implementation

#### [NEW] Application layer (4 files)
- `commands/create-supplier.command.ts`
- `commands/update-supplier.command.ts`
- `queries/get-supplier.query.ts`
- `queries/search-suppliers.query.ts`

#### [NEW] `purchasing-service/src/presentation/supplier.controller.ts`
- REST endpoints: `POST /v1/suppliers`, `GET /v1/suppliers`, `GET /v1/suppliers/:id`, `PATCH /v1/suppliers/:id`

#### [MODIFY] Prisma schema — thêm model Supplier
```prisma
model Supplier {
  id              String    @id @default(uuid())
  name            String
  taxCode         String?   @map("tax_code")
  contactName     String?   @map("contact_name")
  contactPhone    String?   @map("contact_phone")
  contactEmail    String?   @map("contact_email")
  paymentTermDays Int       @default(30) @map("payment_term_days")
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  purchaseOrders PurchaseOrder[]

  @@index([isActive])
  @@map("suppliers")
  @@schema("purchasing")
}
```

#### [MODIFY] PurchaseOrder model — thêm relation
```diff
  model PurchaseOrder {
    ...
    supplierId String @map("supplier_id")
+   supplier   Supplier @relation(fields: [supplierId], references: [id])
    ...
  }
```

#### [MODIFY] `purchasing-service/src/app.module.ts`
- Register SupplierRepository + SupplierController + Commands/Queries

#### [MODIFY] `api-gateway` — thêm proxy route cho `/v1/suppliers`

#### [NEW] Frontend — `frontend/src/app/suppliers/page.tsx`
- Supplier list + CRUD UI (giống customers page)

---

## Phase 2: VAT / Tax per Line (3-5h)

### Catalog Service

#### [MODIFY] `catalog-service/src/domain/entities/product.entity.ts`
```diff
  export interface ProductProps {
    ...
    defaultSalePrice: number;
+   taxRate: number;  // 0 | 0.05 | 0.08 | 0.10
    ...
  }
```
- Thêm method `changeTaxRate(rate: number)` — validate 0/5/8/10% only
- Sửa `create()` factory — accept `taxRate` parameter

#### [MODIFY] Catalog Prisma schema — thêm column
```diff
  model Product {
    ...
    defaultSalePrice Decimal @db.Decimal(15, 2)
+   taxRate          Decimal @default(0.10) @map("tax_rate") @db.Decimal(5, 4)
    ...
  }
```

### Sales Service

#### [MODIFY] `sales-service/src/domain/entities/sales-order-line.entity.ts`
```diff
  export interface SalesOrderLineProps {
    ...
    unitPrice: number;
+   taxRate: number;
+   taxAmount: number;
    lineTotal: number;
    ...
  }
```
- `create()` tính: `subtotal = qty × unitPrice`, `taxAmount = subtotal × taxRate`, `lineTotal = subtotal + taxAmount`

#### [MODIFY] `sales-service/src/domain/entities/sales-order.entity.ts`
```diff
  export interface SalesOrderProps {
    ...
    totalAmount: number;
+   subtotalAmount: number;
+   totalTaxAmount: number;
    ...
  }
```
- Sửa `recalculateTotals()`:
  ```typescript
  this.subtotalAmount = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0);
  this.totalTaxAmount = lines.reduce((sum, l) => sum + l.taxAmount, 0);
  this.totalAmount = this.subtotalAmount + this.totalTaxAmount;
  ```

#### [MODIFY] Sales Prisma schema
```diff
  model SalesOrderLine {
    ...
    unitPrice Decimal @map("unit_price") @db.Decimal(15, 2)
+   taxRate   Decimal @default(0) @map("tax_rate") @db.Decimal(5, 4)
+   taxAmount Decimal @default(0) @map("tax_amount") @db.Decimal(15, 2)
    lineTotal Decimal @map("line_total") @db.Decimal(15, 2)
    ...
  }

  model SalesOrder {
    ...
    totalAmount Decimal @map("total_amount") @db.Decimal(15, 2)
+   subtotalAmount Decimal @default(0) @map("subtotal_amount") @db.Decimal(15, 2)
+   totalTaxAmount Decimal @default(0) @map("total_tax_amount") @db.Decimal(15, 2)
    ...
  }
```

#### Tests — update all calculation tests
#### Frontend — hiển thị subtotal, tax, grandTotal trên order detail page

---

## Phase 3: Delivery Order + Partial Delivery (5-8h)

### Trong sales-service (cùng bounded context với SalesOrder)

#### [NEW] `sales-service/src/domain/entities/delivery-order.entity.ts`
```
DeliveryOrder {
  id: string
  salesOrderId: string
  status: 'draft' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'failed'
  failReason: string | null
  version: number
  lines: DeliveryLine[]
  createdAt, updatedAt
}

Methods:
  - addLine(line): void            // draft only
  - startPicking(): void           // draft → picking
  - pack(): void                   // picking → packed
  - ship(): void                   // packed → shipped
  - confirmDelivery(): void        // shipped → delivered (raises domain event)
  - markFailed(reason): void       // shipped → failed
  - static createFromOrder(id, salesOrderId): DeliveryOrder
```

#### [NEW] `sales-service/src/domain/entities/delivery-line.entity.ts`
```
DeliveryLine {
  id: string
  salesOrderLineId: string
  itemId: string
  itemName: string
  quantity: number
}
```

#### [MODIFY] `sales-service/src/domain/entities/sales-order.entity.ts`
- Thêm states: `partially_delivered`, `fully_delivered` (thay cho `fulfilled`)
- Thêm method `recordDelivery()` — gọi khi DO delivered, check "tất cả đã giao chưa?"
- Sửa `fulfil()` → `markFullyDelivered()` (internal, gọi bởi recordDelivery)

```diff
  export type SalesOrderStatus =
    | 'draft'
    | 'submitted'
    | 'confirmed'
-   | 'fulfilled'
+   | 'partially_delivered'
+   | 'fully_delivered'
    | 'cancelled';
```

#### [NEW] Application layer (4 files)
- `commands/create-delivery-order.command.ts` — tạo DO từ SO confirmed
- `commands/update-delivery-status.command.ts` — chuyển status DO
- `commands/handle-delivery-completed.command.ts` — khi DO delivered → check SO
- `queries/get-delivery-orders.query.ts` — list DO theo SO

#### [NEW] `sales-service/src/presentation/delivery.controller.ts`
- `POST /v1/sales-orders/:id/deliveries` — tạo DO
- `GET /v1/sales-orders/:id/deliveries` — list DO
- `PATCH /v1/deliveries/:id/status` — chuyển status

#### [MODIFY] Prisma schema — thêm 2 models
```prisma
model DeliveryOrder {
  id           String   @id @default(uuid())
  salesOrderId String   @map("sales_order_id")
  status       String   @default("draft")
  failReason   String?  @map("fail_reason")
  version      Int      @default(0)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  lines        DeliveryLine[]
  salesOrder   SalesOrder @relation(fields: [salesOrderId], references: [id])

  @@index([salesOrderId])
  @@index([status])
  @@map("delivery_orders")
  @@schema("sales")
}

model DeliveryLine {
  id               String @id @default(uuid())
  deliveryOrderId  String @map("delivery_order_id")
  salesOrderLineId String @map("sales_order_line_id")
  itemId           String @map("item_id")
  itemName         String @map("item_name")
  quantity         Decimal @db.Decimal(18, 4)

  deliveryOrder DeliveryOrder @relation(fields: [deliveryOrderId], references: [id])

  @@index([deliveryOrderId])
  @@map("delivery_lines")
  @@schema("sales")
}
```

#### Event flow
```
DO.confirmDelivery() → publish "delivery.completed"
  → inventory-service subscribe → issue(items)
  → sales-service self-subscribe → SO.recordDelivery()
    → if tất cả lines đã giao đủ → SO.markFullyDelivered()
```

#### [MODIFY] `fulfil-sales-order.command.ts` → refactor thành create-delivery flow
#### Frontend — thêm delivery tab trong order detail page

---

## Phase 4: Sales Return (4-6h)

### Trong sales-service

#### [NEW] `sales-service/src/domain/entities/sales-return.entity.ts`
```
SalesReturn {
  id: string
  salesOrderId: string
  status: 'draft' | 'approved' | 'received' | 'completed' | 'rejected'
  reason: string
  lines: SalesReturnLine[]
  createdAt, updatedAt
}

Methods:
  - addLine(line): void                // draft only, validate qty ≤ delivered qty
  - approve(): void                    // draft → approved
  - reject(reason): void               // draft → rejected
  - receiveGoods(): void               // approved → received
  - complete(): void                   // received → completed (raises domain event)
  - static create(id, salesOrderId, reason): SalesReturn
```

#### [NEW] `sales-service/src/domain/entities/sales-return-line.entity.ts`
```
SalesReturnLine {
  id: string
  salesOrderLineId: string
  itemId: string
  itemName: string
  quantity: number
  unitPrice: number
  returnAmount: number (qty × unitPrice)
}
```

#### [NEW] Application layer (5 files)
- `commands/create-sales-return.command.ts`
- `commands/approve-sales-return.command.ts`
- `commands/receive-return-goods.command.ts`
- `commands/complete-sales-return.command.ts`
- `queries/get-sales-returns.query.ts`

#### [NEW] `sales-service/src/presentation/return.controller.ts`
- `POST /v1/sales-orders/:id/returns`
- `GET /v1/sales-orders/:id/returns`
- `PATCH /v1/returns/:id/approve`
- `PATCH /v1/returns/:id/receive`
- `PATCH /v1/returns/:id/complete`

#### Event flow (reverse)
```
Return.complete() → publish "sales-return.completed"
  → inventory-service subscribe → receive(items) (nhập lại kho)
  → customer-service subscribe → reduce creditUsedAmount
```

#### [MODIFY] Prisma schema — thêm 2 models
#### [MODIFY] `@erp/shared` contracts — thêm event type + payload
#### Frontend — thêm return tab trong order detail page

---

## Phase 5 (Optional): Multi-address + Extras

### 5.1. Multi-address Customer
- [NEW] Value Object `Address` trong customer-service
- [MODIFY] Customer entity — thêm `addresses: Address[]`
- [MODIFY] Prisma schema — thêm `addresses` JSON column hoặc separate table

### 5.2. Simplified Approval
- [MODIFY] SalesOrder — thêm `requiresApproval`, thêm status `pending_approval`
- [MODIFY] `submit()` — guard clause: if totalAmount > threshold → `pending_approval`
- [NEW] `approve-sales-order.command.ts`

### 5.3. Multi-warehouse
- [MODIFY] StockItem — thêm `warehouseId`
- [NEW] Warehouse entity (simple: id, name, code)
- [MODIFY] reserve/release/issue — filter by warehouseId

---

## Verification Plan

### Automated Tests
```bash
# Phase 0
cd backend/sales-service && npm test
cd backend/inventory-service && npm test
cd backend/customer-service && npm test

# Phase 1-4
cd backend/purchasing-service && npm test
cd backend/sales-service && npm test
cd backend/inventory-service && npm test

# Full CI
npm run lint && npm run build && npm test  # từ backend/
```

### Manual Verification
- Từng phase: start services → test API qua curl/Postman
- Phase 3: Tạo SO → confirm → tạo 2 DO (partial) → deliver cả 2 → verify SO fully_delivered
- Phase 4: Tạo SO → deliver → tạo return → approve → receive → complete → verify stock nhập lại

### Migration
- Mỗi phase có schema change → chạy `npx prisma db push` cho service liên quan
- Phase 0 (Int→Decimal) cần backup data trước vì thay đổi column type
