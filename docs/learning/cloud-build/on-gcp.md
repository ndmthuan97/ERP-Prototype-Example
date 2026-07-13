---
type: Concept Explanation
title: "Cloud Build on GCP"
description: "Đặc thù GCP: builder images, default vs custom service account, ràng buộc logging khi custom SA, substitutions built-in, triggers, mô hình giá"
tags: [cloud-build, gcp, service-account, logging, builder-image, pricing]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Cloud Build on GCP

## Định nghĩa

Những đặc thù GCP quyết định build chạy dưới danh tính nào, log đi đâu, và cách tính tiền.

## Cách hoạt động

### 1. Builder images — công cụ có sẵn

Google cung cấp builder images (`gcr.io/cloud-builders/*`, `gcr.io/google.com/cloudsdktool/cloud-sdk`...) có sẵn `gcloud`, `docker`, `kubectl`... Có thể dùng image bất kỳ làm step.

### 2. Service Account — default vs custom

| | Default Cloud Build SA | Custom SA (dự án) |
|---|---|---|
| Danh tính | `<num>@cloudbuild.gserviceaccount.com` | SA bạn chỉ định (deployer SA) |
| Quyền | Mặc định Google cấp | Bạn kiểm soát chính xác |
| Khi nào | Việc chung | Cần quyền cụ thể (releaser, actAs execution SA) |

> [!IMPORTANT]
> Dự án chạy build **dưới deployer SA** (`--service-account=...`), không phải Cloud Build SA mặc định. Lý do: bước `gcloud deploy releases create` cần `clouddeploy.releaser` + `actAs` execution SA — vốn đã gom sẵn trong deployer SA. Xem [IAM in This Project](../iam/in-this-project.md).

### 3. Ràng buộc logging khi dùng custom SA

> [!WARNING]
> Khi dùng **custom service account**, Cloud Build **bắt buộc** khai nơi ghi log rõ ràng (không dùng bucket log mặc định). Dự án đặt `options.logging: CLOUD_LOGGING_ONLY` trong `cloudbuild.yaml`. Thiếu → build fail ngay với lỗi về logging.

### 4. Substitutions built-in

Ngoài `_USER_VARS`, Cloud Build có biến sẵn: `$PROJECT_ID`, `$BUILD_ID`, `$COMMIT_SHA`, `$SHORT_SHA`... Dự án dùng `$PROJECT_ID` trong đường dẫn image.

### 5. Triggers vs submit

- **Trigger**: gắn với sự kiện repo (push/PR/tag) → Cloud Build tự chạy. Cần kết nối repo.
- **Submit** (`gcloud builds submit`): chủ động gửi build + source. Dự án dùng **submit** từ deploy.yml (GitHub Actions), truyền `--substitutions` + `--service-account`.

### 6. Mô hình giá

```
Chi phí ≈ (build-minute) × (machine type)   [+ free tier hàng ngày]
```

| Yếu tố | Ghi chú |
|---|---|
| Build-minutes | Tính theo thời gian build × loại máy |
| Free tier | Một lượng build-minute/ngày miễn phí |
| Máy mạnh hơn | Nhanh hơn nhưng đắt hơn/phút |

> Build của dự án nhẹ (chỉ chạy `gcloud`, không compile) → nhanh, rẻ, thường trong free tier.

## Ví dụ thực tế

```bash
# deploy.yml submit build dưới deployer SA
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_TAG=${TAG},_RELEASE=${REL} \
  --service-account=projects/${PROJECT}/serviceAccounts/${DEPLOYER_SA} \
  --project=${PROJECT} .
# cloudbuild.yaml: options.logging=CLOUD_LOGGING_ONLY (bắt buộc vì custom SA)
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Build fail: logging required | Custom SA nhưng chưa khai logging | `options.logging: CLOUD_LOGGING_ONLY` |
| `releases create` permission denied | Build SA thiếu `clouddeploy.releaser`/`actAs` | Chạy dưới deployer SA (có sẵn) |
| Không auth được GCP để submit | GitHub thiếu WIF | Auth qua WIF ([WIF](../workload-identity-federation/index.md)) |
| Build chậm/đắt | Máy nhỏ / step thừa | Tối ưu; build nhẹ như dự án thì ổn |

## Related Concepts

- [Core Concepts](./core-concepts.md) — steps, substitutions, logging
- [Cloud Build in This Project](./in-this-project.md) — cloudbuild.yaml
- [IAM in This Project](../iam/in-this-project.md) — deployer SA làm build SA
