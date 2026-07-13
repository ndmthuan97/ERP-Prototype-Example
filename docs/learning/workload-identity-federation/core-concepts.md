---
type: Concept Explanation
title: "WIF Core Concepts"
description: "Building blocks: OIDC token & claims, Workload Identity Pool, Provider, Attribute mapping, Attribute condition, principalSet, Impersonation"
tags: [wif, oidc, pool, provider, attribute-condition, principalset, impersonation]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# WIF Core Concepts

## Định nghĩa

WIF xây trên vài khái niệm cốt lõi. Nắm chúng = dựng liên kết danh tính an toàn, không để repo lạ mượn quyền.

## Tại sao quan trọng

Không hiểu attribute condition → mở toang cho mọi repo GitHub impersonate SA của bạn. Không hiểu pool/provider/binding → auth fail mà không biết mắt xích nào hỏng.

## Cách hoạt động

### 1. OIDC token & claims

GitHub Actions phát một **token OIDC** cho mỗi job, chứa các **claim** mô tả job:

```json
{
  "iss": "https://token.actions.githubusercontent.com",
  "sub": "repo:owner/repo:ref:refs/heads/main",
  "repository": "owner/repo",
  "actor": "some-user",
  "ref": "refs/heads/main"
}
```

Token có **chữ ký** của GitHub và **hết hạn nhanh**. Đây là "hộ chiếu".

### 2. Workload Identity Pool — vùng tin cậy

**Pool** = "vùng chứa" các danh tính ngoài GCP (từ GitHub, AWS...). Là **ranh giới tin cậy** — mọi danh tính liên kết đi qua pool.

### 3. Provider (OIDC) — khai nhà phát hành được tin

**Provider** khai *ai* được tin phát hành token + *cách hiểu* token:

| Thành phần | Vai trò |
|---|---|
| `issuer_uri` | Nhà phát hành tin cậy (GitHub: `token.actions.githubusercontent.com`) |
| `attribute_mapping` | Ánh xạ claim OIDC → thuộc tính GCP |
| `attribute_condition` | Điều kiện lọc token được nhận |

### 4. Attribute mapping — dịch claim sang thuộc tính GCP

```hcl
attribute_mapping = {
  "google.subject"       = "assertion.sub"          # định danh chính
  "attribute.actor"      = "assertion.actor"         # ai chạy (audit)
  "attribute.repository" = "assertion.repository"    # repo nào (để lọc)
}
```

`attribute.repository` sau đó dùng trong condition và trong `principalSet`.

### 5. Attribute condition — RÀO CHẮN quan trọng nhất

Điều kiện quyết định **token nào được nhận**:

```hcl
attribute_condition = "assertion.repository == 'owner/repo'"
```

> [!WARNING]
> **Đây là dòng phòng thủ sống còn.** Không có nó (hoặc quá lỏng), **bất kỳ repo GitHub nào trên thế giới** cũng phát hành được token OIDC hợp lệ (cùng issuer GitHub) và mượn quyền SA của bạn. Condition khoá về đúng repo. Prod thường siết thêm branch/ref (`assertion.ref == 'refs/heads/main'`). Xem [on-gcp](./on-gcp.md).

### 6. principalSet — chỉ định "tập danh tính liên kết"

Trong IAM binding, member kiểu `principalSet://` chỉ **một tập** danh tính đã liên kết (vd mọi run từ repo X):

```
principalSet://iam.googleapis.com/<pool>/attribute.repository/owner/repo
```

= "mọi workflow run từ `owner/repo`". Tập này được cấp quyền impersonate SA.

### 7. Impersonation — mượn danh tính SA

Binding `roles/iam.workloadIdentityUser` cho principalSet đó **đóng vai** deployer SA → mượn quyền của deployer để deploy.

```
GitHub run (principalSet) ──workloadIdentityUser──▶ deployer SA (quyền deploy)
```

Liên hệ khái niệm impersonation tổng quát: [IAM Core Concepts §6](../iam/core-concepts.md).

## Ví dụ thực tế — chuỗi khép kín

```
1. Job chạy trên owner/repo → GitHub phát token OIDC { repository: "owner/repo", ... }
2. Provider verify: issuer == GitHub? attribute_condition (repository == owner/repo) đạt?
3. Đạt → danh tính liên kết thuộc principalSet .../attribute.repository/owner/repo
4. principalSet có workloadIdentityUser trên deployer SA → cấp token deployer (tạm)
5. Job dùng token: push image + Cloud Deploy release
```

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Repo lạ impersonate được SA | Thiếu/lỏng `attribute_condition` | Khoá theo `repository`; prod siết thêm branch |
| Auth fail "unauthorized_client" | Sai `issuer_uri` / mapping | Kiểm issuer GitHub + attribute_mapping |
| `permission denied` sau khi auth OK | principalSet chưa có `workloadIdentityUser` | Thêm binding impersonate trên deployer SA |
| Condition không khớp | Sai định dạng `owner/repo` | Đúng `owner/repo` |

## Related Concepts

- [Overview](./overview.md) — keyless, vấn đề key tĩnh
- [WIF on GCP](./on-gcp.md) — GitHub OIDC, siết bảo mật
- [WIF in This Project](./in-this-project.md) — pool + provider + binding
