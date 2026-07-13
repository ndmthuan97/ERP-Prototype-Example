---
type: Learning Note
title: "Artifact Registry Overview"
description: "Container registry là gì, tại sao cần registry riêng tư, vai trò trong supply chain CI/CD, so sánh với Docker Hub / GCR"
tags: [learning, artifact-registry, docker, container, supply-chain, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Artifact Registry Overview

## Summary

**Artifact Registry** = "kho ảnh Docker" riêng tư, managed. CI **build** image → **push** lên đây; Cloud Run/Cloud Deploy **pull** image từ đây khi deploy. Là **kho trung tâm** — mọi image chạy production đều đi qua nó.

```
   GitHub Actions ──build+push──▶  Artifact Registry  ──pull──▶  Cloud Run
   (Cloud Build)                    erp-services/<svc>:<sha>      (deploy)
                                    (private, IAM-gated)
```

## Key Concepts

### Container image & registry là gì?

- **Container image**: gói bất biến chứa app + runtime + dependency (từ `Dockerfile`).
- **Registry**: nơi lưu & phân phối image (như "npm registry" nhưng cho container).

### Vì sao registry **riêng tư**?

| Nếu để image public | Registry riêng (Artifact Registry) |
|---|---|
| Ai cũng pull được → lộ mã/bí mật đóng trong image | Chỉ danh tính có quyền mới pull |
| Không kiểm soát ai push | IAM kiểm soát push/pull chặt |
| Phụ thuộc rate-limit Docker Hub | Trong cùng project GCP, pull nhanh |

> [!IMPORTANT]
> Image thường **không nên public** vì có thể chứa cấu hình, path nội bộ, đôi khi cả bí mật đóng nhầm. Registry riêng + IAM tách "ai push" (deployer) khỏi "ai pull" (Cloud Run).

### Supply chain — vì sao registry là điểm trọng yếu

```
Code → Build → IMAGE (Artifact Registry) → Deploy → Runtime
                  ▲ kiểm soát ở đây = kiểm soát cái gì chạy production
```

Kiểm soát registry = kiểm soát toàn bộ artifact chạy production: ai đẩy image vào, image nào được giữ, image có lỗ hổng không (scanning). Đây là mắt xích **supply chain security**.

### So sánh lựa chọn

| | **Artifact Registry** | Container Registry (GCR) | Docker Hub |
|---|---|---|---|
| Trạng thái | ✅ Hiện tại (khuyến nghị) | ⚠️ **Deprecated** | Bên thứ ba |
| Đa định dạng | Docker, npm, Maven, Python... | Chỉ Docker | Chỉ Docker |
| IAM GCP | Sâu, per-repo | Cơ bản (qua GCS) | Ngoài GCP |
| Rate limit | Không (trong project) | — | Có (public) |

> [!WARNING]
> **Container Registry (GCR, `gcr.io`) đã deprecated.** Dự án mới dùng **Artifact Registry** (`*-docker.pkg.dev`). Đừng tạo mới trên GCR. Xem [on-gcp](./on-gcp.md).

### Cross-cloud

| GCP | AWS | Azure |
|---|---|---|
| **Artifact Registry** | ECR | Azure Container Registry (ACR) |

### Vị trí trong kiến trúc ERP

```
GitHub Actions (WIF → deployer SA) ──build──▶ Artifact Registry: erp-services/<svc>:<sha>
                                                     │ Cloud Deploy trỏ image theo SHA
                                                     ▼
                                               Cloud Run pull (cùng region → nhanh)
```

## Practical Application

Dùng Artifact Registry khi:
- Cần lưu image riêng tư cho app trên GCP.
- Muốn IAM kiểm soát push/pull + scanning lỗ hổng.
- Muốn cleanup tự động để không phình dung lượng.

## References

- [Artifact Registry Docs](https://cloud.google.com/artifact-registry/docs) — tài liệu chính thức
- [Transition from Container Registry](https://cloud.google.com/artifact-registry/docs/transition/transition-from-gcr) — GCR đã deprecated
- [Cleanup policies](https://cloud.google.com/artifact-registry/docs/repositories/cleanup-policy) — dọn image cũ

## Related Concepts

- [Core Concepts](./core-concepts.md) — repo, tag, digest, cleanup
- [Artifact Registry on GCP](./on-gcp.md) — GCR deprecated, scanning, IAM
- [Artifact Registry in This Project](./in-this-project.md) — repo erp-services
