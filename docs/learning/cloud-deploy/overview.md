---
type: Learning Note
title: "Cloud Deploy Overview"
description: "Continuous Delivery là gì, CI vs CD, tại sao Cloud Deploy managed, so sánh với gcloud tay / ArgoCD / Spinnaker"
tags: [learning, cloud-deploy, cd, continuous-delivery, gcp]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Deploy Overview

## Summary

**Google Cloud Deploy** = dịch vụ **CD (Continuous Delivery)** managed. Nó nhận một **image + manifest** và lo **rollout** lên môi trường (dev → staging → prod), có **promotion**, **rollback**, **audit**. Trong ERP, Cloud Deploy **sở hữu spec service Cloud Run** (thay Terraform).

```
   CI (build+test)         CD (Cloud Deploy)              Runtime
  ┌────────────────┐      ┌────────────────────────┐     ┌──────────┐
  │ code → image   │─────▶│ Release → Render →      │────▶│ Cloud Run│
  │ (Artifact Reg) │      │ Rollout → (promote/     │     │  (dev)   │
  │                │      │ rollback)               │     └──────────┘
  └────────────────┘      └────────────────────────┘
```

## Key Concepts

### CI vs CD — ranh giới

| | **CI** (Continuous Integration) | **CD** (Continuous Delivery/Deploy) |
|---|---|---|
| Lo | Build + test + tạo artifact (image) | Đưa artifact ra môi trường (rollout) |
| Câu hỏi | "Code có build & pass test?" | "Đưa bản này lên dev/prod thế nào, rollback ra sao?" |
| Trong ERP | GitHub Actions (ci-backend/frontend) | **Cloud Deploy** (qua Cloud Build tạo release) |

### Vì sao dùng CD managed (không deploy tay)?

| Deploy tay (`gcloud run deploy`) | Cloud Deploy |
|---|---|
| Không lịch sử release chuẩn | Mỗi release có bản ghi, audit |
| Rollback = nhớ lệnh cũ | Rollback = chọn rollout trước (1 thao tác) |
| Promotion dev→prod thủ công | Pipeline hoá promotion |
| Digest không ghim rõ | Render ghim **digest** → rollback đúng bản |

> [!IMPORTANT]
> Giá trị lớn nhất: **release là đối tượng có lịch sử + digest cố định**. Rollback không phải "build lại bản cũ" mà "trỏ về rollout đã render sẵn" → nhanh và đúng.

### So sánh CD tools

| | **Cloud Deploy** | ArgoCD | Spinnaker |
|---|---|---|---|
| Managed | ✅ Google | Tự vận hành (K8s) | Tự vận hành (nặng) |
| Đích | Cloud Run, GKE | GKE (GitOps) | Đa cloud |
| Render | Skaffold | Kustomize/Helm | Nhiều |
| Độ phức tạp | Thấp | Vừa | Cao |

Dự án ở GCP, đích là Cloud Run, muốn managed → **Cloud Deploy** đúng nấc.

### Vị trí trong kiến trúc ERP (CI/CD)

```
GitHub Actions (CI: build+push image)
   └─workflow_run→ deploy.yml ─submit→ Cloud Build ─tạo release→ Cloud Deploy
                                                                    │ render (skaffold)
                                                                    ▼ rollout
                                                                 Cloud Run (dev)
```

> [!NOTE]
> Cloud Deploy **sở hữu spec** service (`deploy/*/service.yaml`) — Terraform không còn quản spec Cloud Run. Đây là điểm drift quan trọng, xem [Cloud Run in This Project](../cloud-run/in-this-project.md).

## Practical Application

Dùng Cloud Deploy khi:
- Muốn rollout có kiểm soát (lịch sử, rollback, promotion) tới Cloud Run/GKE.
- Muốn tách "build image" (CI) khỏi "đưa ra môi trường" (CD).

## References

- [Cloud Deploy Docs](https://cloud.google.com/deploy/docs) — tài liệu chính thức
- [Cloud Deploy for Cloud Run](https://cloud.google.com/deploy/docs/deploy-app-run) — đích Cloud Run
- [Skaffold](https://skaffold.dev/) — công cụ render Cloud Deploy dùng

## Related Concepts

- [Core Concepts](./core-concepts.md) — pipeline, target, release, rollout
- [Cloud Deploy on GCP](./on-gcp.md) — skaffold, execution SA
- [Cloud Deploy in This Project](./in-this-project.md) — 8 pipeline + target dev
