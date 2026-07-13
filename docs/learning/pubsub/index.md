# Pub/Sub — Pareto 80/20 Knowledge Bundle

Kiến thức cốt lõi về **Pub/Sub** — messaging bất đồng bộ (event-driven) trên Google Cloud, xương sống giao tiếp giữa các microservice ERP. Theo Pareto: 20% quan trọng nhất để thiết kế luồng sự kiện đúng.

## Concepts

| Concept | Type | Mô tả |
|---------|------|-------|
| [Overview](./overview.md) | Learning Note | Messaging bất đồng bộ là gì, sync vs async, tại sao decouple, so Kafka/SQS |
| [Core Concepts](./core-concepts.md) | Concept Explanation | Topic, Subscription, Publisher/Subscriber, Ack, At-least-once, Dead-letter, Retry, Ordering |
| [Pub/Sub on GCP](./on-gcp.md) | Concept Explanation | Push vs Pull, message retention, exactly-once, service agent, mô hình giá |
| [Pub/Sub in This Project](./in-this-project.md) | Reference | Mapping → module `pubsub`: 9 topic sự kiện + dead-letter + IAM service agent |
| [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md) | Reference | Idempotency, dead-letter fail âm thầm, ack deadline, ordering |

## Lộ trình đọc

1. **Bắt đầu**: [Overview](./overview.md) → vì sao async/decouple
2. **Nền tảng**: [Core Concepts](./core-concepts.md) → topic/sub/ack/dead-letter
3. **GCP cụ thể**: [Pub/Sub on GCP](./on-gcp.md) → push vs pull, service agent
4. **Áp dụng**: [Pub/Sub in This Project](./in-this-project.md) → 9 topic sự kiện ERP
5. **Debug**: [Troubleshooting & Pitfalls](./troubleshooting-and-pitfalls.md)

## Liên quan

- [IAM & Service Accounts](../iam/index.md) — backend SA có `pubsub.publisher/subscriber`; service agent cho dead-letter
- [Cloud Run](../cloud-run/index.md) — service publish/consume event
- [event-flows.md](../../architecture/event-flows.md) — nguồn định nghĩa topic/subscriber
