---
type: Reference
title: "Skill Assessment & Learning Roadmap — Staff Developer"
description: "Phân loại 30 skills theo mức độ cần thiết cho Staff Developer, chia track để chọn hướng chuyên môn"
tags: [skills, assessment, roadmap, onboarding, new-erp, staff-developer]
timestamp: "2026-06-29T10:42:00+07:00"
diataxis: reference
---

# Skill Assessment — Staff Developer

Không phải engineer nào cũng cần học hết 30 skills. Tài liệu này phân loại theo **3 mức độ cần thiết** và **3 track chuyên môn** để bạn chọn đúng hướng, học đúng thứ.

> [!NOTE]
> Nguồn: tổng hợp từ `new-erp-design/` — `02-new-system-overview.md`, `team-transition-plan.md`, `SE-process-review.md`, `vietnam-team-handoff-guide.md`. Skill heatmap từ `team-staffing.html`.

---

## Cách đọc tài liệu này

1. **Bước 1** — Đọc phần **Mức độ cần thiết** để biết skill nào bắt buộc, skill nào không cần
2. **Bước 2** — Chọn **1 track** phù hợp với bản thân (Backend / Frontend / Data)
3. **Bước 3** — Đánh dấu trạng thái hiện tại (🔴/🟡/🟢), lên kế hoạch học theo thứ tự

---

## 3 Mức độ cần thiết

| Mức | Ký hiệu | Ý nghĩa | Ai cần |
|-----|---------|---------|--------|
| **Bắt buộc** | 🔴 MUST | Không có thì không làm việc được | Mọi engineer |
| **Theo track** | 🟡 TRACK | Cần cho track bạn chọn, không cần cho track khác | Tùy hướng chuyên môn |
| **Chưa cần** | ⚪ SKIP | Chuyên biệt cho role khác — có thể chọn học khi sẵn sàng | Không cần học lúc này |

---

## Phần 1 — 🔴 MUST: Bắt buộc cho MỌI Staff Developer (7 skills)

Dù bạn chọn track nào, 7 skills này đều phải có. Đây là nền tảng chung.

| # | Skill | Mô tả ngắn | Mốc đạt | Tự đánh giá |
|---|-------|-----------|---------|-------------|
| 1 | **TypeScript** | Ngôn ngữ duy nhất dùng cho cả BE lẫn FE | Viết 1 module TS compile không lỗi, hiểu types/interfaces/async | 🔴 / 🟡 / 🟢 |
| 2 | **Git / GitHub** | PR workflow + code review — bắt buộc Day-1 | Mở PR, qua CI, merge thành công | 🔴 / 🟡 / 🟢 |
| 3 | **Docker cơ bản** | Mọi service chạy trong container | Build image, run local, đọc Dockerfile | 🔴 / 🟡 / 🟢 |
| 4 | **GCP Console cơ bản** | Navigate Console, xem logs, check service status | Mở project, tìm Cloud Run service, xem logs | 🔴 / 🟡 / 🟢 |
| 5 | **REST API cơ bản** | HTTP methods, status codes, request/response | Gọi API bằng Postman/curl, đọc OpenAPI spec | 🔴 / 🟡 / 🟢 |
| 6 | **PostgreSQL cơ bản** | SELECT/INSERT/UPDATE, JOINs, WHERE | Viết query lấy dữ liệu, hiểu schema | 🔴 / 🟡 / 🟢 |
| 7 | **Testing cơ bản** | Unit test với Jest/Vitest | Viết 3+ unit tests cho 1 function, pass CI | 🔴 / 🟡 / 🟢 |

> [!TIP]
> **Thời gian ước tính**: 3–4 tuần nếu học full-time. Đây là Phase 0 — hoàn thành trước khi chạm vào bất kỳ track nào.

---

## Phần 2 — 🟡 TRACK: Chọn 1 trong 3 hướng

Sau khi vững 7 skills MUST, chọn **1 track chính** phù hợp sở trường và nhu cầu team.

### Track A — Backend Developer 🔧

> Xây API services, viết business logic, làm việc với database.

| # | Skill | Mô tả | Mức trong track | Mốc đạt |
|---|-------|-------|-----------------|---------|
| A1 | **NestJS** | Framework BE chính | Cốt lõi | CRUD API hoàn chỉnh với validation |
| A2 | **PG ORM (Prisma)** | ORM cho PostgreSQL | Cốt lõi | Define schema + relations, viết migration |
| A3 | **Cloud Run deploy** | Deploy service lên GCP | Cốt lõi | Deploy 1 NestJS app lên staging |
| A4 | **Cloud SQL** | PostgreSQL managed | Cốt lõi | Connect từ Cloud Run, query tối ưu |
| A5 | **Pub/Sub cơ bản** | Gửi/nhận event giữa services | Nâng cao | Publish 1 event, subscribe và xử lý |
| A6 | **JWT / Auth guard** | Authentication trong NestJS | Nâng cao | Implement auth middleware, protect routes |

**Thời gian**: 6–8 tuần sau Phase 0

**Phù hợp nếu bạn**: Thích logic, xử lý data, viết API, làm việc với database

---

### Track B — Frontend Developer 🎨

> Build UI, làm việc với React/Next.js, tạo trải nghiệm người dùng.

| # | Skill | Mô tả | Mức trong track | Mốc đạt |
|---|-------|-------|-----------------|---------|
| B1 | **React** | Library UI chính | Cốt lõi | Build form component với hooks + validation |
| B2 | **Next.js** | Framework FE — routing, SSR | Cốt lõi | Build 1 page fetch data từ API |
| B3 | **State Management** | React Query / Zustand | Cốt lõi | Implement data fetching + caching |
| B4 | **Responsive / Mobile-first CSS** | UI cho sales reps + warehouse staff | Cốt lõi | Layout hoạt động tốt trên mobile |
| B5 | **API integration** | Gọi REST API từ frontend | Nâng cao | CRUD hoàn chỉnh qua API, handle errors |
| B6 | **Testing FE** | Component testing với Testing Library | Nâng cao | Viết test cho 1 form component |

**Thời gian**: 6–8 tuần sau Phase 0

**Phù hợp nếu bạn**: Thích UI/UX, visual, tương tác người dùng, CSS

---

### Track C — Data / Analytics 📊

> Build analytics pipeline, viết queries phân tích, dashboard.

| # | Skill | Mô tả | Mức trong track | Mốc đạt |
|---|-------|-------|-----------------|---------|
| C1 | **BigQuery** | Data warehouse cho analytics | Cốt lõi | Viết query phân tích trên BigQuery |
| C2 | **SQL nâng cao** | Window functions, CTEs, aggregation | Cốt lõi | Query phức tạp (revenue by province) |
| C3 | **dbt** | Transform data có version control | Cốt lõi | Viết + test 1 dbt model |
| C4 | **Datastream** | CDC: Cloud SQL → BigQuery | Nâng cao | Hiểu flow CDC, đọc replicated data |
| C5 | **Semantic Layer** | Lightdash / Cube cho KPI dashboard | Nâng cao | Define 1 metric + build chart |

**Thời gian**: 6–8 tuần sau Phase 0

**Phù hợp nếu bạn**: Thích data, SQL, phân tích, reporting, dashboard

---

## Phần 3 — ⚪ SKIP: Chưa cần, nhưng có thể chọn học khi sẵn sàng

Các skills dưới đây **không phải ưu tiên** cho Staff Developer lúc bắt đầu. Phân thành **5 nhóm** — khi nào muốn mở rộng, chọn nhóm phù hợp.

---

### Nhóm S1 — DevOps & Infrastructure 🛠️

> **Khi nào nên học**: Khi bạn muốn hiểu sâu hơn cách hệ thống được deploy và vận hành, hoặc muốn chuyển hướng sang DevOps.

| # | Skill | Mô tả | Độ khó | Prerequisite | Tài liệu |
|---|-------|-------|--------|-------------|----------|
| S1.1 | **Terraform (IaC)** | Viết code để tạo/quản lý GCP resources tự động | Trung bình | GCP Console cơ bản | [Terraform GCP Tutorial](https://developer.hashicorp.com/terraform/tutorials/gcp-get-started) |
| S1.2 | **Cloud Deploy** | Pipeline deploy: dev → staging → prod với approval gate | Trung bình | Docker, Git | [Cloud Deploy Docs](https://cloud.google.com/deploy/docs) |
| S1.3 | **Artifact Registry** | Lưu trữ Docker images + quét lỗ hổng | Dễ | Docker | [Artifact Registry Docs](https://cloud.google.com/artifact-registry/docs) |
| S1.4 | **Cloud Monitor + Logging** | Tạo dashboard, alert rules, đọc logs có cấu trúc | Dễ–TB | GCP Console | [Cloud Operations Docs](https://cloud.google.com/products/operations) |
| S1.5 | **Sentry** | Error tracking — xem lỗi runtime, stack trace, user impact | Dễ | TypeScript | [Sentry Docs](https://docs.sentry.io/) |

| Ai đang phụ trách chính | Lợi ích nếu bạn học |
|-------------------------|---------------------|
| Hiếu (Infra Lead) | Tự debug deployment issues, hiểu CI/CD pipeline, tự đọc logs khi service lỗi |

---

### Nhóm S2 — Security & Auth 🔒

> **Khi nào nên học**: Khi bạn cần implement auth guard trong service, hoặc muốn hiểu hệ thống RBAC.

| # | Skill | Mô tả | Độ khó | Prerequisite | Tài liệu |
|---|-------|-------|--------|-------------|----------|
| S2.1 | **Identity Platform** | Google's auth service — SSO, MFA, user management | Trung bình | REST API, GCP Console | [Identity Platform Docs](https://cloud.google.com/identity-platform/docs) |
| S2.2 | **Cloud Armor (WAF)** | Firewall rules, DDoS protection, rate limiting | Trung bình | Networking cơ bản | [Cloud Armor Docs](https://cloud.google.com/armor/docs) |

| Ai đang phụ trách chính | Lợi ích nếu bạn học |
|-------------------------|---------------------|
| Hiếu + Senior engineer | Hiểu cách auth hoạt động end-to-end, tự config RBAC cho feature mình làm |

---

### Nhóm S3 — Integration & Middleware 🔌

> **Khi nào nên học**: Khi bạn được assign module liên quan đến hệ thống bên ngoài (kế toán, bank, cache).

| # | Skill | Mô tả | Độ khó | Prerequisite | Tài liệu |
|---|-------|-------|--------|-------------|----------|
| S3.1 | **FAST API Integration** | Tích hợp hệ thống kế toán FAST — tracking table, 3-way match | Cao | REST API, NestJS | `new-erp-design/research/fast-accounting.md`, ADR 0002 |
| S3.2 | **Redis / Memorystore** | Caching — cache-aside, TTL, session store, rate limiting | Trung bình | NestJS hoặc backend framework | [Redis Docs](https://redis.io/docs/) |
| S3.3 | **Cloud Workflows** | Orchestrate multi-step flows (thay Power Automate) | Trung bình | YAML, Cloud Run | [Cloud Workflows Docs](https://cloud.google.com/workflows/docs) |

| Ai đang phụ trách chính | Lợi ích nếu bạn học |
|-------------------------|---------------------|
| Đệ (FAST), Senior Backend | Tự viết adapter service, implement caching cho API, hiểu saga pattern |

---

### Nhóm S4 — AI & Mobile 🤖📱

> **Khi nào nên học**: Phase 3+ (AI) hoặc Phase 7 (Mobile). Chỉ học khi project thực sự cần.

| # | Skill | Mô tả | Độ khó | Prerequisite | Tài liệu |
|---|-------|-------|--------|-------------|----------|
| S4.1 | **Vertex AI + Gemini** | Gọi AI model cho invoice mapping, forecasting, Zalo parsing | Trung bình | REST API, GCP Console | [Vertex AI Docs](https://cloud.google.com/vertex-ai/docs) |
| S4.2 | **React Native** | Mobile app cho WMS — QR scan, offline-first | Cao | React | [React Native Docs](https://reactnative.dev/) |

| Ai đang phụ trách chính | Lợi ích nếu bạn học |
|-------------------------|---------------------|
| AI Engineer (chưa hire), Mobile Specialist | Mở rộng career sang AI-assisted features hoặc mobile development |

---

### Nhóm S5 — Architecture & Data nâng cao 🏗️

> **Khi nào nên học**: Khi bạn đã vững track chính (6+ tháng) và muốn nâng lên Senior level.

| # | Skill | Mô tả | Độ khó | Prerequisite | Tài liệu |
|---|-------|-------|--------|-------------|----------|
| S5.1 | **Semantic Layer (Lightdash/Cube)** | Define metrics + self-serve dashboard cho KPI | Trung bình | dbt, BigQuery | [Lightdash Docs](https://docs.lightdash.com/) |
| S5.2 | **DDD nâng cao** | Aggregate roots, domain events, ubiquitous language | Cao | OOP, backend experience | Sách: *Domain-Driven Design* (Eric Evans) |
| S5.3 | **CQRS + Event Sourcing** | Tách write/read model cho hot paths | Cao | Pub/Sub, PostgreSQL | Sách: *Designing Data-Intensive Applications* |
| S5.4 | **Saga Pattern** | Distributed transaction với compensating actions | Cao | Event-driven, state machines | `new-erp-design/02-new-system-overview.md` §2.13 Pattern 7 |

| Ai đang phụ trách chính | Lợi ích nếu bạn học |
|-------------------------|---------------------|
| Tiền, Hiếu, Senior Engineers | Con đường lên Senior — hiểu và thiết kế architecture, không chỉ implement |

---

### Tổng hợp nhóm SKIP

| Nhóm | Số skills | Độ ưu tiên mở rộng | Thời điểm phù hợp |
|------|----------|--------------------|--------------------|
| S1 DevOps & Infra | 5 | ⭐⭐⭐ Cao | Sau 2–3 tháng — giúp tự chủ khi deploy/debug |
| S2 Security & Auth | 2 | ⭐⭐ TB | Khi assign module Auth hoặc RBAC-related |
| S3 Integration | 3 | ⭐⭐ TB | Khi assign module tích hợp external system |
| S4 AI & Mobile | 2 | ⭐ Thấp | Phase 3+ (AI) hoặc Phase 7 (Mobile) |
| S5 Architecture | 4 | ⭐⭐⭐ Cao (dài hạn) | Sau 6+ tháng — con đường lên Senior |

> [!TIP]
> **Gợi ý thứ tự mở rộng**: Sau khi vững track chính → **S1** (DevOps cơ bản, tự chủ hơn) → **S5** (architecture, lên Senior) → S2/S3 (khi cần) → S4 (tương lai xa).

---

## Tổng hợp — Bạn thực sự cần học bao nhiêu?

| Phân loại | Số skills | Thời gian ước tính |
|-----------|----------|-------------------|
| 🔴 MUST (bắt buộc) | **7** | 3–4 tuần |
| 🟡 TRACK (chọn 1 track) | **5–6** | 6–8 tuần |
| ⚪ SKIP (chọn thêm khi sẵn sàng) | **16** | Tùy nhóm |
| **Tổng cần học ban đầu** | **12–13** | **~10–12 tuần** |

So với tổng 30 skills, bạn chỉ cần tập trung vào **~13 skills** — chưa đến một nửa.

---

## Lộ trình gợi ý cho readiness 17%

```
Tuần 1–2     ████████░░  TypeScript + Git
Tuần 3–4     ████████░░  Docker + GCP Console + SQL cơ bản + REST API + Testing
                          → Xong Phase 0: deploy Hello World, merge PR đầu tiên
Tuần 5–6     ████░░░░░░  Track skill #1 + #2 (cốt lõi)
Tuần 7–8     ██████░░░░  Track skill #3 + #4 (cốt lõi)
Tuần 9–10    ████████░░  Track skill #5 + #6 (nâng cao)
Tuần 11–12   ██████████  Pair programming trên module thật
                          → Xong: tự viết + deploy 1 feature end-to-end
```

---

## Tiếp theo — Bạn cần quyết định

Sau khi đọc xong, hãy trả lời 2 câu hỏi:

1. **7 skills MUST**: Bạn hiện tại ở đâu? (đánh dấu 🔴/🟡/🟢 cho từng skill)
2. **Chọn track nào?** Backend (A) / Frontend (B) / Data (C)

Từ đó mình sẽ xây lộ trình chi tiết theo tuần.

---

## Related Concepts

- [Terraform Learning](./terraform/index.md)
