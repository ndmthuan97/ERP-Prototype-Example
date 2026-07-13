# Gap Analysis

So sánh trạng thái implement của `erp-prototype-example` với thiết kế target trong `new-erp-design/`. Mỗi doc soi một mảng: cái gì đã có, cái gì lệch, cần làm gì khi build thật.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Auth & Session Gap](./prototype-vs-newdesign-auth-gap.md) | Reference | Auth prototype (sau B1: Google sign-in + session whitelist) vs design (Identity Platform + Workspace SSO); FR-A13/FR-A9 đã đóng, còn deviation domain SSO/MFA/OTP/RBAC-as-code |
| [CDC & Reporting Gap](./prototype-vs-newdesign-cdc-gap.md) | Reference | OLTP core (đã xong) vs analytics pipeline (Datastream/BigQuery/dbt chưa implement) |
