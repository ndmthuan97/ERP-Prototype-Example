# Bàn giao CI/CD sang Cloud Deploy — Runbook

> Chuyển từ **CI tự `gcloud run deploy`** → **CI(GH Actions) → CD(Cloud Build) → Cloud Deploy**.
> Spec Cloud Run chuyển từ Terraform sang manifest (`deploy/manifests/*.yaml`).
> Terraform chỉ còn lo nền tảng (VPC/DB/secret/SA/registry/WIF) + IAM của service.

Kiến trúc: xem [../docs/architecture/cicd-pipeline.md](../docs/architecture/cicd-pipeline.md).

---

## 0. Điều kiện

- `gcloud` đã đăng nhập, project = `portfolio-497506`, region = `us-central1`.
- Đã bật API: `clouddeploy.googleapis.com` (nếu chưa: `gcloud services enable clouddeploy.googleapis.com`).
- 8 service `*-dev` đang chạy (bàn giao từ Terraform). Nếu làm từ số 0, xem **§6**.

---

## 1. Bàn giao Terraform state (KHÔNG destroy service) — làm 1 lần

`infra/environments/dev/main.tf` đã **bỏ** `module.cloud_run` + `null_resource.gateway_env_vars`.
Nếu `terraform apply` ngay, Terraform sẽ đòi **destroy 8 service đang chạy**. Gỡ khỏi state trước:

```bash
cd infra/environments/dev
terraform state rm 'module.cloud_run'
terraform state rm 'null_resource.gateway_env_vars'
```

`state rm` chỉ gỡ khỏi state — service GCP **vẫn chạy**, giờ do Cloud Deploy tiếp quản.

> ✅ Backstop: `terraform plan` sau bước này KHÔNG được hiện `google_cloud_run_v2_service ... destroy`.
> Nếu còn hiện "to destroy" → chưa `state rm` xong, **DỪNG, đừng approve**.

---

## 2. Apply Terraform (IAM Cloud Deploy + IAM service)

```bash
terraform apply
```

Áp dụng: 2 role Cloud Deploy cho `erp-deployer-dev` (`clouddeploy.releaser`, `clouddeploy.jobRunner`)
+ IAM invoker (`public`, `gateway_invoker`) trỏ service theo tên literal. Vì service đang tồn tại,
`enable_service_iam=true` (mặc định) apply được ngay.

---

## 3. Điền URL gateway vào manifest — làm 1 lần

Trước do `null_resource` inject; giờ khai thẳng trong [manifests/api-gateway.yaml](manifests/api-gateway.yaml).
Lấy URL thật (ổn định theo vòng đời service):

```bash
gcloud run services list --region=us-central1 \
  --format='value(metadata.name,status.url)' --project=portfolio-497506
```

Thay 7 chỗ `__FILL_..._URL__` trong `manifests/api-gateway.yaml`:

| Env var | Điền URL của |
|---|---|
| `AUTH_SERVICE_URL` | auth-service-dev |
| `CUSTOMER_SERVICE_URL` | customer-service-dev |
| `ORDER_SERVICE_URL` | **sales-service-dev** |
| `INVENTORY_SERVICE_URL` | inventory-service-dev |
| `CATALOG_SERVICE_URL` | catalog-service-dev |
| `PURCHASING_SERVICE_URL` | purchasing-service-dev |
| `CORS_ORIGINS` | `<frontend-dev URL>,http://localhost:3000` |

> URL đổi chỉ khi service bị xóa+tạo lại. Nếu điều đó xảy ra → cập nhật lại đây rồi release.

---

## 4. Tạo delivery pipeline + target — làm 1 lần (và mỗi khi đổi pipeline)

```bash
gcloud deploy apply --file=deploy/clouddeploy.yaml \
  --region=us-central1 --project=portfolio-497506
```

---

## 5. Release đầu tiên + verify

CI đã đẩy `:latest` cho mỗi service. Tạo release (2 cách):

**A. Qua CI/CD (khuyến nghị):** GitHub → Actions → **CD — Release via Cloud Build → Cloud Deploy**
→ Run workflow (`tag=latest`). Nó submit Cloud Build → tạo release → rollout.

**B. Thủ công tại máy** (⚠️ PowerShell: PHẢI bọc `--substitutions` trong ngoặc kép,
nếu không dấu `,` bị PowerShell hiểu là toán tử array → `_RELEASE` rơi về default +
`_TAG` dính rác → render FAILED):
```powershell
gcloud builds submit --config=cloudbuild.yaml `
  --substitutions="_TAG=latest,_RELEASE=rel-bootstrap-1" `
  --service-account=projects/portfolio-497506/serviceAccounts/erp-deployer-dev@portfolio-497506.iam.gserviceaccount.com `
  --project=portfolio-497506 .
```

> ⚠️ **8 pipeline, không phải 1.** Cloud Deploy + Cloud Run chỉ nhận 1 service/pipeline
> (skaffold: "expected singular node ... but was 8"). Nên có 8 pipeline `erp-<service>`
> dùng chung 1 target `dev`; mỗi lần release = 8 release (mỗi pipeline 1 cái, cùng tên).

Verify từng pipeline (state rollout):
```powershell
foreach ($s in 'api-gateway','auth-service','customer-service','sales-service','inventory-service','catalog-service','purchasing-service','frontend') {
  gcloud deploy rollouts list --delivery-pipeline="erp-$s" --release=rel-bootstrap-1 `
    --region=us-central1 --project=portfolio-497506 --format="value(name.basename(),state)"
}
# health gateway + login thử
curl https://api-gateway-dev-s3fou5y5yq-uc.a.run.app/health
```
So spec service với manifest (env/secret/VPC/SA/port) — nếu lệch, sửa manifest rồi release lại.

---

## 6. Bootstrap từ số 0 (chưa có service nào)

Khác §1–2: chưa có service nên IAM invoker chưa apply được.
1. `terraform apply -var enable_service_iam=false` (nền tảng + SA + WIF + registry, chưa IAM service).
2. §3, §4.
3. Release đầu (§5) → Cloud Deploy tạo 8 service.
4. `terraform apply -var enable_service_iam=true` → thêm IAM invoker.

---

## Vận hành thường ngày (sau bàn giao)

- **Merge `main`** → CI verify+build+push → `workflow_run` chạy `deploy.yml` → Cloud Build → release → rollout. Tự động.
- **Rollback**: KHÔNG rebuild. Rollback theo TỪNG pipeline (service) cần lùi:
  ```bash
  gcloud deploy targets rollback dev --delivery-pipeline=erp-<service> --region=us-central1
  ```
  (hoặc UI Cloud Deploy → chọn pipeline → release cũ → Rollback.)
- **Thêm staging/prod sau**: thêm Target block + stage trong `clouddeploy.yaml`, provision infra env mới, đặt `requireApproval: true` trên Target prod.

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `terraform plan` đòi destroy service | Chưa `state rm` (§1) | Chạy §1 |
| Gateway 503, route sai | `__FILL_*__` chưa điền (§3) | Điền URL, release lại |
| Build fail `PERMISSION_DENIED clouddeploy` | Thiếu role trên deployer SA | `terraform apply` (§2) đã thêm; kiểm IAM |
| Release fail `cannot act as service account` | Deployer thiếu actAs runtime SA | Đã có `roles/iam.serviceAccountUser` project-wide; kiểm binding |
| Rollout fail probe | Sai `startupProbe.path` trong manifest | Backend `/health/live`, gateway/frontend `/health` |
