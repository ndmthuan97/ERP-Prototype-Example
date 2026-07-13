---
type: Concept Explanation
title: "Redis on GCP — Upstash vs Memorystore"
description: "Hai cách chạy Redis cho workload GCP: Upstash (REST/HTTP, serverless, external) vs Memorystore (TCP, trong VPC). Vì sao dự án chọn Upstash cho Cloud Run"
tags: [redis, gcp, upstash, memorystore, serverless, vpc]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Redis on GCP — Upstash vs Memorystore

## Định nghĩa

Hai cách phổ biến để có Redis cho app trên GCP, mỗi cách hợp một kiểu compute khác nhau.

## Cách hoạt động

### 1. Hai lựa chọn

| | **Upstash Redis** (dự án dùng) | **Memorystore for Redis** (GCP native) |
|---|---|---|
| Giao thức | **REST/HTTP** (HTTPS) | **TCP** (Redis protocol) |
| Kết nối | Qua internet, không cần VPC | Private IP trong VPC |
| Mô hình giá | **Pay-per-request** (scale-to-zero) | Trả tiền instance 24/7 |
| Hợp compute | **Serverless** (Cloud Run, Edge) | VM/GKE/Cloud Run có VPC |
| Vận hành | External SaaS, free tier | Managed bởi Google |

### 2. Vì sao Cloud Run + serverless hợp REST (Upstash)

```
Redis TCP (Memorystore):     Cloud Run instance mở kết nối TCP bền → giữ pool
   → scale-to-zero + nhiều instance = pool connection phập phù, cần VPC connector
Redis REST (Upstash):        mỗi thao tác = 1 HTTP request stateless
   → hợp scale-to-zero: không pool, không giữ kết nối, không cần VPC
```

> [!IMPORTANT]
> Cloud Run **scale-to-zero** và tạo/huỷ instance liên tục → kết nối TCP bền (pool) tới Redis dễ phập phù và cần đi qua VPC. **Upstash dùng REST (HTTP)** → mỗi lệnh là 1 request stateless, không pool, không cần VPC connector. Đây là lý do dự án chọn Upstash cho backend Cloud Run.

### 3. Đánh đổi

| Ưu Upstash | Nhược Upstash |
|---|---|
| Không cần VPC; hợp serverless | HTTP overhead/lệnh cao hơn TCP (mỗi op 1 round-trip HTTPS) |
| Scale-to-zero, free tier | Latency phụ thuộc mạng internet (không private) |
| Không quản instance | External vendor (ngoài GCP) |

> Khi cần **throughput cực cao / latency siêu thấp / private-only**, cân nhắc chuyển Memorystore (TCP, trong VPC) — đánh đổi: mất scale-to-zero, phải qua VPC connector. Với ERP prototype, Upstash là nấc đúng (YAGNI).

### 4. Bảo mật kết nối

- Upstash: HTTPS + **token** (REST). Credentials (`UPSTASH_REDIS_REST_URL` + `..._TOKEN`) cất trong [Secret Manager](../secret-manager/index.md), inject vào Cloud Run qua `secret_key_ref`.
- Không như Cloud SQL (private IP + VPC), Upstash đi qua internet nhưng **mã hoá TLS + token** → an toàn nếu token không lộ.

### 5. Chi phí

```
Upstash:      pay-per-request + free tier (đủ dev nhỏ) → ~$0 khi tải thấp
Memorystore:  trả tiền instance theo GB RAM, 24/7 (không scale-to-zero)
```

## Ví dụ thực tế

```
Backend Cloud Run (scale-to-zero) ──HTTPS + token──▶ Upstash Redis (REST)
  env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  (từ Secret Manager)
  không VPC connector cho Redis (khác Cloud SQL vốn cần VPC)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Cố nối Upstash qua TCP/pool | Upstash là REST, không TCP | Dùng client REST (`@upstash/redis`) |
| Tưởng cần VPC connector cho Redis | Upstash đi qua HTTPS internet | Không cần VPC cho Upstash (khác Cloud SQL) |
| Latency cao mỗi op | HTTP round-trip/lệnh | Gộp thao tác; cân nhắc Memorystore nếu nóng |
| Token lộ | Cất sai chỗ | Chỉ để trong Secret Manager, không hardcode |

## Related Concepts

- [Core Concepts](./core-concepts.md) — TTL, atomic, cache patterns
- [Redis in This Project](./in-this-project.md) — RedisCacheService (Upstash REST)
- [Cloud Run on GCP](../cloud-run/on-gcp.md) — vì sao scale-to-zero ghét kết nối bền
