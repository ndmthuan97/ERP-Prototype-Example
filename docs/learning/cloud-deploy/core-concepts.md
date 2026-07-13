---
type: Concept Explanation
title: "Cloud Deploy Core Concepts"
description: "Building blocks: Delivery Pipeline, Target, Release, Rollout, Render (Skaffold), Promotion, Rollback, Approval"
tags: [cloud-deploy, delivery-pipeline, target, release, rollout, skaffold, rollback]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Deploy Core Concepts

## Định nghĩa

Cloud Deploy xây trên vài khái niệm cốt lõi. Nắm chúng = hiểu một bản code đi từ image tới Cloud Run và rollback thế nào.

## Tại sao quan trọng

Không hiểu release vs rollout → không biết rollback trỏ vào đâu. Không hiểu target/pipeline → không hiểu vì sao dự án cần 8 pipeline.

## Cách hoạt động

### 1. Delivery Pipeline — quy trình giao hàng

Định nghĩa **các stage** một release đi qua (dev → staging → prod). Là "đường ray" của quá trình phát hành.

```
DeliveryPipeline: dev → staging → prod   (mỗi mũi tên là 1 promotion)
```

### 2. Target — môi trường đích

Một **Target** = một môi trường (Cloud Run ở region X, hoặc 1 cluster GKE). Khai *deploy vào đâu* + *bằng danh tính nào* (execution SA).

### 3. Release — ảnh chụp bất biến để phát hành

Một **Release** = ảnh chụp (manifest + image) tại một thời điểm. Tạo release = "chuẩn bị một bản để rollout". Release **bất biến** → cơ sở của rollback.

### 4. Render — Skaffold biến manifest thành thứ deploy được

Khi tạo release, Cloud Deploy chạy **Skaffold** để **render**: thay image placeholder bằng image thật + **ghim digest**, sinh manifest cuối.

```
service.yaml (image: placeholder)  ──render (skaffold)──▶  manifest (image@sha256:...)
                                    (ghim digest → rollback đúng bản)
```

### 5. Rollout — thực thi deploy release vào target

**Rollout** = hành động đưa một release vào một target. 1 release có thể rollout ra nhiều target (qua promotion). Rollback = tạo rollout mới trỏ về **release cũ**.

```
Release r-123 ──rollout──▶ Target dev  ──(promote)──▶ Target prod
```

### 6. Promotion — đẩy release lên môi trường kế

Sau khi release chạy tốt ở dev → **promote** lên staging/prod (cùng release, cùng digest → nhất quán giữa môi trường).

### 7. Rollback — quay về bản trước

Trỏ target về **rollout/release trước đó**. Vì release + digest bất biến, rollback nhanh và đúng — không rebuild.

> [!IMPORTANT]
> **Rollback ≠ deploy lại code cũ.** Nó tạo rollout mới trỏ về release đã render sẵn (digest cố định). Điều kiện: image của release cũ **còn** trong [Artifact Registry](../artifact-registry/index.md) (⇒ cleanup phải đủ rộng).

### 8. Approval (tuỳ chọn)

Có thể yêu cầu **phê duyệt thủ công** trước khi promote lên prod → chốt kiểm soát ở cửa production.

## Ví dụ thực tế

```
1. CI build image → Artifact Registry
2. Cloud Build: gcloud deploy releases create → tạo Release
3. Cloud Deploy render (skaffold): ghim image digest
4. Rollout release vào Target dev → Cloud Run cập nhật
5. (prod) promote release dev→prod (nếu có), hoặc approval
6. Lỗi → rollback: rollout mới trỏ về release trước
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Rollback không tìm thấy bản cũ | Image release cũ đã bị GC | Tăng cleanup `keep_count` (Artifact Registry) |
| Release fail lúc render | Skaffold/manifest sai | Kiểm skaffold.yaml + service.yaml |
| Deploy fail: thiếu quyền | Execution SA thiếu role | Cấp cho execution SA (xem [on-gcp](./on-gcp.md)) |
| Prod nhận bản chưa duyệt | Không đặt approval | Bật required approval trên stage prod |

## Related Concepts

- [Overview](./overview.md) — CI vs CD
- [Cloud Deploy on GCP](./on-gcp.md) — skaffold, execution SA, digest
- [Cloud Deploy in This Project](./in-this-project.md) — 8 pipeline + target dev
