---
type: Concept Explanation
title: "Artifact Registry Core Concepts"
description: "Building blocks: Repository, Format, Image + Tag + Digest, Layers, Cleanup policy (KEEP/DELETE), Immutability & rollback"
tags: [artifact-registry, docker, repository, tag, digest, cleanup-policy]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Artifact Registry Core Concepts

## Định nghĩa

Artifact Registry xây trên vài khái niệm cốt lõi. Nắm chúng = push/pull đúng, và quản vòng đời image không phá rollback.

## Tại sao quan trọng

Không hiểu tag vs digest → deploy không xác định được. Không hiểu cleanup policy → GC mất image cần rollback. Không hiểu location → pull chậm + phí egress.

## Cách hoạt động

### 1. Repository — kho chứa artifact

Một **repository** chứa artifact cùng loại. Có `format` (Docker/npm/Maven...), `location` (region), quyền IAM riêng. Dự án: 1 repo Docker `erp-services` chứa image của cả 8 service.

### 2. Format

| Format | Chứa |
|---|---|
| `DOCKER` | Container image (dự án dùng) |
| `NPM` / `MAVEN` / `PYTHON` | Package ngôn ngữ tương ứng |

### 3. Image path: registry / project / repo / image : tag

```
us-central1-docker.pkg.dev / my-erp / erp-services / auth-service : sha-a1b2c3
└──── registry host ─────┘  └proj┘   └── repo ──┘  └─ image ─┘  └── tag ──┘
```

### 4. Tag vs Digest — điểm cốt lõi

| | **Tag** | **Digest** |
|---|---|---|
| Dạng | `:v1.2`, `:latest`, `:sha-abc` | `@sha256:...` (hash nội dung) |
| Bất biến? | **Không** — tag có thể trỏ lại image khác | **Có** — hash thay đổi nếu nội dung đổi |
| Deploy | Tiện đọc nhưng mơ hồ | Xác định tuyệt đối |

```
auth-service:latest  → hôm nay = image X, mai = image Y   (tag di động)
auth-service@sha256:abc...  → LUÔN đúng 1 image           (bất biến)
```

> [!TIP]
> Deploy production nên tham chiếu **digest** hoặc tag **immutable theo commit SHA** (`:sha-<commit>`), không dùng `:latest` — để rollback/audit xác định. Dự án tag theo **commit SHA**.

### 5. Layers — vì sao push/pull nhanh

Image gồm nhiều **layer** xếp chồng; layer trùng được **chia sẻ & cache**. Đổi 1 dòng code chỉ push layer trên cùng → nhanh, tiết kiệm dung lượng.

### 6. Cleanup Policy — dọn image cũ tự động

Luật tự xoá/giữ image để không phình dung lượng. Hai kiểu action:

| Action | Nghĩa |
|---|---|
| `KEEP` | Giữ lại N version gần nhất (phần cũ hơn bị GC) |
| `DELETE` | Xoá theo điều kiện (tuổi, số lượng, tag prefix) |

```
cleanup: KEEP most_recent_versions = 20
  → giữ 20 image gần nhất mỗi image; cũ hơn bị dọn
```

> [!WARNING]
> **Cleanup policy phải khớp chiến lược rollback.** Giữ quá ít → rollback về commit SHA cũ **fail** vì image đã bị GC. Dự án giữ **20** (từng để 5 và bị GC mất SHA cần roll back). Xem [in-this-project](./in-this-project.md).

### 7. Immutability & rollback

Image bất biến (định danh bằng digest). Rollback = **trỏ lại image cũ đã có sẵn**, không rebuild. Điều kiện: image cũ **vẫn còn** trong registry (⇒ cleanup phải đủ rộng).

## Ví dụ thực tế

```
repo erp-services (DOCKER, us-central1)
 ├── auth-service:sha-a1b2c3   (layer nền chia sẻ với các service khác)
 ├── auth-service:sha-d4e5f6
 └── ... (cleanup KEEP 20 gần nhất mỗi image)
Cloud Run deploy: image = us-central1-docker.pkg.dev/my-erp/erp-services/auth-service:sha-...
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Rollback fail "image not found" | Cleanup GC mất SHA cũ | Tăng `keep_count` khớp tần suất deploy |
| Deploy ra image sai/ngẫu nhiên | Dùng tag `:latest` di động | Tag theo commit SHA / dùng digest |
| Registry phình vô hạn | Không có cleanup policy | Thêm `cleanup_policies` |
| Pull chậm | Repo khác region với Cloud Run | Đặt repo cùng region |

## Related Concepts

- [Overview](./overview.md) — supply chain, vì sao registry riêng
- [Artifact Registry on GCP](./on-gcp.md) — IAM, scanning, GCR deprecated
- [Artifact Registry in This Project](./in-this-project.md) — repo erp-services + keep 20
