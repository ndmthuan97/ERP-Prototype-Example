---
type: Concept Explanation
title: "Artifact Registry on GCP"
description: "Đặc thù GCP: Artifact Registry vs Container Registry (GCR deprecated), location & egress, IAM per-repo, vulnerability scanning, docker auth, mô hình giá"
tags: [artifact-registry, gcp, gcr, iam, vulnerability-scanning, pricing]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Artifact Registry on GCP

## Định nghĩa

Những đặc thù GCP quyết định cách push/pull, ai được làm, và cách tính tiền.

## Cách hoạt động

### 1. Artifact Registry vs Container Registry (GCR)

| | Artifact Registry | Container Registry (GCR) |
|---|---|---|
| Host | `<region>-docker.pkg.dev` | `gcr.io` (lưu qua GCS bucket) |
| Trạng thái | ✅ Khuyến nghị | ⚠️ **Deprecated** |
| Đa định dạng | Docker, npm, Maven, Python... | Chỉ Docker |
| IAM | Per-repository, chi tiết | Qua quyền bucket GCS (thô) |

> [!IMPORTANT]
> GCR đã deprecated — dự án dùng **Artifact Registry** (`us-central1-docker.pkg.dev/...`). Đừng khởi tạo mới trên `gcr.io`.

### 2. Location — regional / multi-region

Repo có `location`. Đặt **cùng region** với Cloud Run:
- Pull nhanh (gần).
- **Tránh phí egress** liên vùng khi Cloud Run kéo image.

Dự án: repo `us-central1`, Cloud Run cũng `us-central1`.

### 3. IAM — ai push, ai pull

| Vai trò | Role | Ai |
|---|---|---|
| Push image | `roles/artifactregistry.writer` | deployer SA (CI/CD) |
| Pull image | `roles/artifactregistry.reader` | Cloud Run service agent (mặc định trong cùng project thường đủ) |
| Quản repo | `roles/artifactregistry.admin` | Hạn chế |

> Least privilege: CI chỉ cần **writer** (push), không cần admin. Xem [IAM in This Project](../iam/in-this-project.md).

### 4. Docker authentication

Để `docker push/pull` tới Artifact Registry, cần cấu hình credential helper:

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

Trong CI, danh tính đến từ **WIF** (impersonate deployer SA) — không dùng key tĩnh. Xem [WIF](../workload-identity-federation/index.md).

### 5. Vulnerability scanning

Artifact Registry có thể tự **quét lỗ hổng** (CVE) image khi push → cảnh báo package dính lỗ hổng. Một phần supply-chain security. Bật khi cần siết bảo mật (có thể phát sinh phí scan).

### 6. Mô hình giá

```
Chi phí ≈ (storage GB image lưu) + (egress khi pull ra ngoài region/internet) [+ scanning nếu bật]
```

| Yếu tố | Ghi chú |
|---|---|
| Storage | Theo GB image lưu — **cleanup policy** giúp giảm |
| Egress | Pull cùng region rẻ; khác region/internet tính egress |
| Scanning | Tính theo image quét (nếu bật) |

> [!TIP]
> Hai đòn bẩy chi phí: (1) **cleanup policy** để không giữ image thừa, (2) **cùng region** để pull khỏi tính egress. Layer chia sẻ cũng giảm storage.

## Ví dụ thực tế

```
Repo erp-services @ us-central1 (Docker)
  push: GitHub Actions (WIF → deployer SA có artifactregistry.writer)
  pull: Cloud Run @ us-central1 (cùng region → nhanh, không egress)
  cleanup: KEEP 20 gần nhất
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `denied: permission` khi push | Deployer thiếu `artifactregistry.writer` | Cấp writer cho deployer SA |
| `docker push` fail auth | Chưa `configure-docker` / thiếu WIF token | Cấu hình credential helper; auth qua WIF |
| Pull chậm + hoá đơn egress | Repo khác region Cloud Run | Đặt repo cùng region |
| Vẫn đẩy lên gcr.io | Dùng registry cũ deprecated | Chuyển sang `*-docker.pkg.dev` |

## Related Concepts

- [Core Concepts](./core-concepts.md) — tag/digest, cleanup, immutability
- [Artifact Registry in This Project](./in-this-project.md) — repo erp-services
- [Workload Identity Federation](../workload-identity-federation/index.md) — CI auth keyless
