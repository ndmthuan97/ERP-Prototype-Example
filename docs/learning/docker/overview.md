---
type: Learning Note
title: "Docker Overview"
description: "Container là gì, container vs VM, tại sao Docker, image vs container, chuẩn OCI, vai trò trong CI/CD"
tags: [learning, docker, container, oci, ci-cd]
diataxis: explanation
timestamp: "2026-07-06T10:00:00+07:00"
---

# Docker Overview

## Summary

**Docker** đóng gói app + runtime + dependency vào một **image** bất biến, chạy trong **container** — cô lập, nhẹ, nhất quán "chạy được ở máy tôi = chạy được ở prod".

```
   "Works on my machine" problem        Docker
  ┌────────────────────────┐          ┌──────────────────────────┐
  │ máy dev: Node 22, lib X │          │  IMAGE (Node 22 + lib X   │
  │ prod:    Node 18, lib Y │   ──▶    │  + app, đóng băng)        │
  │ → lệch → bug bí ẩn      │          │  chạy giống hệt mọi nơi   │
  └────────────────────────┘          └──────────────────────────┘
```

## Key Concepts

### Container vs Virtual Machine

| | Container | VM |
|---|---|---|
| Cô lập | Process-level (chia sẻ kernel host) | Full OS riêng |
| Kích thước | MB, khởi động ~giây | GB, khởi động ~phút |
| Overhead | Thấp | Cao |
| Hợp cho | Microservice, CI/CD, serverless | Cách ly mạnh, OS khác nhau |

```
VM:                          Container:
┌──────────────┐            ┌──────────────┐
│ App          │            │ App          │
│ Guest OS     │            │ (chỉ app +   │
│ Hypervisor   │            │  lib)        │
│ Host OS      │            │ Docker Engine│
│ Hardware     │            │ Host OS      │
└──────────────┘            └──────────────┘
 nặng, đầy đủ OS             nhẹ, chia kernel
```

### Image vs Container

| | **Image** | **Container** |
|---|---|---|
| Là gì | Bản mẫu **bất biến** (đọc-only) | **Instance đang chạy** của image |
| Ví von | Class / bản thiết kế | Object / căn nhà đã xây |
| Số lượng | 1 image | Chạy được nhiều container từ 1 image |

### Vì sao Docker cho microservice + serverless

- **Nhất quán**: cùng image chạy giống nhau ở dev/CI/prod.
- **Cô lập**: mỗi service 1 container, không đụng dependency nhau.
- **Cloud Run cần container**: Cloud Run chạy *image* — Docker là cách tạo ra nó.

### OCI — chuẩn mở

Image/registry theo chuẩn **OCI** (Open Container Initiative) → không khoá vào Docker. Cloud Run, Artifact Registry, containerd... đều hiểu image OCI. "Docker image" ≈ "OCI image" trong thực tế.

### Vị trí trong kiến trúc ERP (CI/CD)

```
Code + Dockerfile ──docker build──▶ IMAGE ──push──▶ Artifact Registry ──▶ Cloud Run
   (backend: 1 Dockerfile chung 7 service; frontend: 1 Dockerfile Next.js)
```

## Practical Application

Dùng Docker để:
- Đóng gói mỗi service thành image chạy trên Cloud Run.
- Chạy local giống prod (`docker run` / compose).
- Làm đơn vị build trong CI (GitHub Actions `docker build`).

Container phải tuân **container contract** của Cloud Run (nghe `$PORT`, `0.0.0.0`, stateless) — xem [Cloud Run Core Concepts](../cloud-run/core-concepts.md).

## References

- [Docker Docs](https://docs.docker.com/) — tài liệu chính thức
- [Dockerfile reference](https://docs.docker.com/reference/dockerfile/) — cú pháp
- [OCI](https://opencontainers.org/) — chuẩn mở container

## Related Concepts

- [Core Concepts](./core-concepts.md) — Dockerfile, layer, cache
- [Best Practices](./best-practices.md) — multi-stage, nhỏ, an toàn
- [Docker in This Project](./in-this-project.md) — 2 Dockerfile thật
