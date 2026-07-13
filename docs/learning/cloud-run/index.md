# Cloud Run — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Cloud Run** (serverless containers trên Google Cloud) theo nguyên tắc Pareto: 20% nội dung quan trọng nhất giúp nắm 80% năng lực thực chiến. Mental model áp dụng cho mọi serverless-container platform (AWS App Runner, Azure Container Apps, Knative).

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Serverless container là gì, tại sao Cloud Run, so với GKE/Functions/App Engine |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Service, Revision, Traffic split, Concurrency, Scaling, Cold start, Container contract |
| [Cloud Run on GCP](./on-gcp.md) | Concept Explanation | Gen2 runtime, mô hình giá, min-instances, CPU boost, v1 vs v2, VPC egress |
| [Cloud Run in This Project](./in-this-project.md) | Reference | Mapping → module `cloud-run` + drift: spec đã dời sang Cloud Deploy |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Cold start, 503, container contract, IAM invoker, secret access |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → hiểu "tại sao serverless container"
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → service/revision/concurrency/scaling
3. **GCP cụ thể**: [Cloud Run on GCP](./on-gcp.md) → giá, tuning, VPC egress
4. **Áp dụng**: [Cloud Run in This Project](./in-this-project.md) → code thật + drift Cloud Deploy
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [IAM & Service Accounts](../iam/index.md) — runtime SA & invoker binding
- [Secret Manager](../secret-manager/index.md) — nguồn secret env
- [VPC & Networking](../vpc/index.md) — VPC Connector & egress
- [Artifact Registry](../artifact-registry/index.md) — nơi chứa image
