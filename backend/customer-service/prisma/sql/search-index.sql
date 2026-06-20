-- =============================================================================
-- SEARCH INDEX — Trigram GIN cho businessName (tối ưu ILIKE '%q%')
-- =============================================================================
-- Vì sao file riêng (không nằm trong schema.prisma)?
--   Tìm kiếm khách hàng dùng `contains` → SQL `ILIKE '%q%'` (leading wildcard).
--   Btree index KHÔNG dùng được cho leading wildcard → cần GIN + pg_trgm.
--   Prisma schema chưa biểu diễn được pg_trgm/GIN operator class, nên tạo bằng raw SQL.
--
-- Khi nào chạy?
--   - Tùy chọn cho dev (data nhỏ thì seq scan vẫn nhanh).
--   - BẮT BUỘC trước khi lên production / khi bảng cores lớn dần.
--
-- Cách chạy (qua direct connection — DIRECT_URL):
--   psql "$DIRECT_URL" -f prisma/sql/search-index.sql
--   (Supabase: dán vào SQL Editor)
--
-- Idempotent: chạy nhiều lần không lỗi.

-- pg_trgm: Supabase thường đã cài sẵn (schema "extensions"). IF NOT EXISTS cho an toàn.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index trên business_name (schema "customer")
CREATE INDEX IF NOT EXISTS "idx_cores_business_name_trgm"
  ON "customer"."cores"
  USING gin ("business_name" gin_trgm_ops);
