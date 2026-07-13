# Docker — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Docker** (container) — cách đóng gói app thành image bất biến để chạy nhất quán từ máy dev tới Cloud Run. Theo Pareto: 20% quan trọng nhất để viết Dockerfile tốt, nhỏ, an toàn.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Container là gì, container vs VM, tại sao Docker, image vs container, OCI |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Dockerfile, Image, Layer, Build cache, Container, Port/Env, Volume, ENTRYPOINT/CMD |
| [Best Practices](./best-practices.md) | Concept Explanation | Multi-stage build, base image nhỏ, thứ tự layer cho cache, non-root, .dockerignore, không bake secret |
| [Docker in This Project](./in-this-project.md) | Reference | Mapping → `backend/Dockerfile` (multi-stage, SERVICE_DIR) + `frontend/Dockerfile` (Next standalone) |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Image phình, cache miss, chạy root, hardcode PORT, secret trong image |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → container vs VM, vì sao Docker
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → Dockerfile, layer, cache
3. **Chuẩn hoá**: [Best Practices](./best-practices.md) → multi-stage, nhỏ, an toàn
4. **Áp dụng**: [Docker in This Project](./in-this-project.md) → 2 Dockerfile thật
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [Artifact Registry](../artifact-registry/index.md) — nơi image được push/lưu
- [Cloud Run](../cloud-run/index.md) — container contract (PORT, 0.0.0.0, stateless)
- [Cloud Build](../cloud-build/index.md) & [Cloud Deploy](../cloud-deploy/index.md) — build & rollout image
