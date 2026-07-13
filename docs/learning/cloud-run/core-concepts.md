---
type: Concept Explanation
title: "Cloud Run Core Concepts"
description: "7 building blocks: Service, Revision, Traffic split, Concurrency, Scaling & scale-to-zero, Cold start, Container contract"
tags: [cloud-run, serverless, revision, concurrency, scaling, cold-start]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Run Core Concepts

## Định nghĩa

Cloud Run xây trên vài khái niệm cốt lõi. Nắm chúng = hiểu 80% cách service hành xử, tính tiền, và fail.

## Tại sao quan trọng

Không hiểu revision/concurrency/cold-start = không giải thích được vì sao request đầu chậm, vì sao rollback được, vì sao service nghẽn CPU dù "còn nhiều instance".

## Cách hoạt động

### 1. Service — đơn vị deploy

Một **Service** = một app HTTP, có URL riêng, tự scale. Đây là đối tượng bạn tạo/quản. Trong dự án: `api-gateway-dev`, `auth-service-dev`, ... (8 service).

### 2. Revision — ảnh chụp bất biến

Mỗi lần deploy tạo một **Revision** mới = ảnh chụp *bất biến* của (image + config + env + resource). Revision **không sửa được** — muốn đổi thì tạo revision mới.

```
auth-service-dev
 ├── revision-0001 (image:sha-a, mem 512Mi)   ← cũ
 ├── revision-0002 (image:sha-b, mem 512Mi)
 └── revision-0003 (image:sha-c, mem 1Gi)     ← đang nhận traffic
```

> [!TIP]
> **Rollback = trỏ traffic về revision cũ.** Vì revision bất biến, "quay lại bản trước" chỉ là chuyển traffic — không rebuild, không redeploy. Đây là lý do phải giữ đủ image cũ trong [Artifact Registry](../artifact-registry/index.md).

### 3. Traffic split — chia traffic giữa các revision

Bạn có thể chia % traffic giữa nhiều revision → **canary / blue-green** deploy.

```
revision-0003  90% ─┐
revision-0002  10% ─┴─▶ users   (canary: soi 10% trước khi lên 100%)
```

### 4. Concurrency — số request/instance

Một **instance** xử lý bao nhiêu request **cùng lúc**. Đây là khác biệt lớn nhất với Cloud Functions (concurrency = 1).

```
concurrency = 80         concurrency = 1 (như Functions)
┌───────────────┐        ┌───┐┌───┐┌───┐┌───┐
│ 1 instance    │        │ 1 ││ 1 ││ 1 ││ 1 │  ← tốn nhiều instance hơn
│ 80 req song  │        └───┘└───┘└───┘└───┘
└───────────────┘
```

| Concurrency cao | Concurrency thấp |
|---|---|
| Ít instance → rẻ hơn | Nhiều instance → đắt hơn |
| Rủi ro nghẽn CPU nếu request nặng | Cách ly tốt, ít nhiễu |
| Hợp I/O-bound (chờ DB/API) | Hợp CPU-bound (tính nặng) |

> [!IMPORTANT]
> Container **phải an toàn khi xử lý nhiều request song song** (thread-safe / async). Nếu code giả định "1 request 1 lúc", đặt concurrency cao sẽ sinh bug race.

### 5. Scaling & scale-to-zero

Cloud Run tự tăng/giảm số instance theo tải, giữa `min_instance_count` và `max_instance_count`.

```
Tải:   ▁▁▂▅█████▅▂▁▁▁▁▁▁
Inst:  0 0 1 2 4 4 4 2 1 0 0 0    (min=0 → về 0 khi hết request)
```

- `min = 0` (scale-to-zero): hết request → 0 instance → **~$0**. Đánh đổi: **cold start**.
- `min > 0` (warm): luôn giữ N instance nóng → không cold start, nhưng **trả tiền 24/7**.

### 6. Cold start — cái giá của scale-to-zero

Khi không có instance sẵn, request đầu phải chờ container **khởi động** (pull image → boot → sẵn sàng nhận). Đó là **cold start** (~vài trăm ms tới vài giây tuỳ image/app).

```
Request đến (đang 0 instance)
   │  [pull image] [start container] [app boot] [startup probe OK]
   ▼──────────────── cold start ────────────────▶ mới xử lý request
```

Giảm cold start: image nhỏ, boot nhanh, `min > 0` cho service nóng, bật **startup CPU boost** (xem [on-gcp](./on-gcp.md)).

### 7. Container contract — hợp đồng container phải tuân

Container muốn chạy trên Cloud Run **phải**:

| Điều kiện | Ý nghĩa |
|---|---|
| Nghe trên `$PORT` | Cloud Run tiêm biến `PORT` (mặc định 8080); app phải bind vào đó, không hardcode |
| Nghe `0.0.0.0` | Không phải `localhost` — nếu không request không tới được |
| Stateless | Instance có thể bị giết bất kỳ lúc nào; không lưu state cục bộ |
| Phản hồi trong timeout | Quá `timeout` (dự án: 300s) → request bị cắt |
| Khởi động đủ nhanh | Fail `startup_probe` nhiều lần → revision bị coi hỏng |

## Ví dụ thực tế

```
Deploy image mới → tạo revision-0004
   → startup probe /health OK
   → chuyển 100% traffic sang 0004
   → tải tăng: scale 0→5 instance, mỗi instance 80 req song song
   → tải giảm về 0: scale về 0 sau vài phút idle
   → phát hiện lỗi: trỏ traffic về revision-0003 (rollback tức thì)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Deploy fail "container failed to start" | App không nghe `$PORT` / `0.0.0.0` | Bind vào `process.env.PORT`, host `0.0.0.0` |
| Request đầu chậm | Cold start | `min>0` cho service nóng; giảm kích thước image |
| 503 khi tải cao | Chạm `max_instance_count` | Tăng max; hoặc tăng concurrency nếu I/O-bound |
| Race condition ngẫu nhiên | Concurrency cao + code không thread-safe | Giảm concurrency hoặc sửa code async-safe |
| Mất dữ liệu sau restart | Lưu state trong RAM/disk cục bộ | Đẩy state ra DB/Redis (stateless) |

## Related Concepts

- [Overview](./overview.md) — vì sao serverless container
- [Cloud Run on GCP](./on-gcp.md) — giá, min-instances, CPU boost, VPC egress
- [Cloud Run in This Project](./in-this-project.md) — cấu hình thật của 8 service
