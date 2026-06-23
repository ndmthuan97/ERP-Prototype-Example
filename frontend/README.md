# ERP Frontend — Next.js 15 + Ant Design 5

Frontend cho ERP Prototype. Giao tiếp qua **API Gateway** (:3010) duy nhất.

## Chạy

```bash
cd frontend
cp .env.local.example .env.local      # chỉnh port nếu cần
npm install
npm run dev                            # http://localhost:3000
```

> Cần backend chạy trước: `api-gateway` (:3010) + các service downstream.

## Cấu trúc

```
src/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # AntdRegistry + Providers + AppShell + ErrorBoundary
│   ├── providers.tsx         # React Query + ConfigProvider(vi_VN) + Auth
│   ├── page.tsx              # Dashboard (KPI cards + charts + tables)
│   ├── customers/            # Customer CRUD
│   ├── inventory/            # Inventory management
│   ├── orders/               # Sales order lifecycle
│   ├── catalog/              # Product catalog
│   └── purchasing/           # Purchase orders
├── components/
│   ├── AppShell.tsx          # Sider menu + header
│   ├── ErrorBoundary.tsx     # React Error Boundary
│   └── StatCard.tsx          # Reusable KPI card
└── lib/
    ├── api/
    │   ├── client.ts         # HTTP layer (auth + correlation + error handling)
    │   ├── config.ts         # API Gateway base URL
    │   ├── errors.ts         # ApiError + field mapping
    │   ├── types.ts          # Types matching BE shape
    │   ├── customer.ts       # Customer endpoints
    │   ├── inventory.ts      # Inventory endpoints
    │   └── sales.ts          # Sales order endpoints
    ├── auth/
    │   ├── AuthProvider.tsx   # Auth context (JWT tokens)
    │   └── token.ts          # Token ↔ apiClient bridge
    └── format.ts             # VND + datetime formatting
```

## Nguyên tắc

- **Mọi call API đi qua `apiClient`** — không `fetch` rải rác. Auth/correlation/error xử lý 1 chỗ.
- **API Gateway** là điểm truy cập duy nhất — frontend không gọi trực tiếp service.
- **Tiền VND** = số nguyên đồng (BE ép `.int()`).
- **Error Boundary** bao bọc toàn bộ content — JS error không crash trắng trang.
