# Jest Testing — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Jest** — test framework cho backend NestJS (TypeScript) của ERP. Theo Pareto: 20% quan trọng nhất để viết test có giá trị, chạy nhanh, tin cậy.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Tại sao test, unit/integration/e2e, test pyramid, tại sao Jest, vs Vitest/Mocha |
| [Core Concepts](./core-concepts.md) | Concept Explanation | describe/it, expect/matchers, setup/teardown, mock/spy, async test, coverage |
| [Best Practices](./best-practices.md) | Concept Explanation | AAA pattern, test behavior không test impl, mock ở ranh giới, deterministic, DDD/CQRS |
| [Jest in This Project](./in-this-project.md) | Reference | Mapping → backend NestJS: ts-jest, config/service, e2e, cấu trúc DDD, CI verify |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Flaky test, mock rò rỉ, async không await, over-mock, coverage giả |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → vì sao test + test pyramid
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → describe/it/expect/mock/async
3. **Chuẩn hoá**: [Best Practices](./best-practices.md) → AAA, test behavior
4. **Áp dụng**: [Jest in This Project](./in-this-project.md) → NestJS + ts-jest + CI
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Cloud Build](../cloud-build/index.md) & CI — test là quality gate chặn build+deploy khi fail
- [Redis](../redis/index.md) & [Pub/Sub](../pubsub/index.md) — mock ở ranh giới khi test service phụ thuộc chúng
