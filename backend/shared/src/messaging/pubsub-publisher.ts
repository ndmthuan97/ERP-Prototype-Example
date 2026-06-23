// =============================================================================
// PUBSUB PUBLISHER — Wrapper quanh @google-cloud/pubsub dùng chung mọi service
// =============================================================================
// Tách riêng việc publish khỏi Outbox Worker (Single Responsibility):
// - Worker lo VÒNG ĐỜI (poll outbox, đánh dấu published, retry).
// - Publisher lo KỸ THUẬT publish (đảm bảo topic tồn tại, serialize, gửi).
//
// Tối ưu: cache danh sách topic đã đảm bảo tồn tại (ensuredTopics) →
// KHÔNG gọi topic.exists() mỗi lần publish (bản cũ trong customer-service
// round-trip Pub/Sub mỗi event — lãng phí). Sau lần đầu, publish thẳng.

import { Injectable, Logger } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import {
  EVENT_ENVELOPE_VERSION,
  type EventEnvelope,
} from '../contracts/events';

/** Tuỳ chọn khi publish — eventId BẮT BUỘC (khoá dedup), còn lại optional. */
export interface PublishOptions {
  /** Khoá dedup ổn định cho consumer — thường là id dòng outbox */
  eventId: string;
  /** correlationId truy vết (worker đọc từ payload đã lưu, vì chạy ngoài request) */
  correlationId?: string | null;
  /** Phiên bản envelope — mặc định EVENT_ENVELOPE_VERSION */
  eventVersion?: number;
}

@Injectable()
export class PubSubPublisher {
  private readonly logger = new Logger(PubSubPublisher.name);

  /**
   * Client Pub/Sub. Khi PUBSUB_EMULATOR_HOST được set (dev), SDK tự kết nối
   * emulator. Khi deploy GCP: bỏ env → kết nối Pub/Sub thật, zero code change.
   */
  private readonly pubsub: PubSub;

  /** Cache tên topic đã chắc chắn tồn tại — tránh exists() mỗi lần publish */
  private readonly ensuredTopics = new Set<string>();

  constructor() {
    this.pubsub = new PubSub({
      projectId: process.env.PUBSUB_PROJECT_ID ?? 'erp-prototype',
    });
  }

  /**
   * Publish 1 event lên topic trùng tên eventType (vd: "customer.created").
   * Lần đầu gặp 1 topic: kiểm tra/tạo rồi nhớ vào cache. Các lần sau: gửi thẳng.
   *
   * Bọc payload trong EventEnvelope (có eventId/version/correlationId) và gắn
   * các khoá quan trọng vào message attributes → consumer dedup/route không cần
   * parse body.
   *
   * @param eventType - Tên event = tên topic
   * @param payload   - Dữ liệu nghiệp vụ (sẽ nằm trong envelope.payload)
   * @param options   - eventId (bắt buộc), correlationId, eventVersion
   */
  async publish(
    eventType: string,
    payload: unknown,
    options: PublishOptions,
  ): Promise<void> {
    const topic = this.pubsub.topic(eventType);

    // Chỉ kiểm tra tồn tại đúng 1 lần cho mỗi topic trong vòng đời process
    if (!this.ensuredTopics.has(eventType)) {
      const [exists] = await topic.exists();
      if (!exists) {
        await topic.create();
        this.logger.log(`Created new Pub/Sub topic: "${eventType}"`);
      }
      this.ensuredTopics.add(eventType);
    }

    const correlationId = options.correlationId ?? null;
    const envelope: EventEnvelope = {
      eventId: options.eventId,
      eventType,
      eventVersion: options.eventVersion ?? EVENT_ENVELOPE_VERSION,
      occurredAt: new Date().toISOString(),
      correlationId,
      payload,
    };

    // attributes: khoá dedup/route ở dạng metadata (không cần parse JSON body)
    const attributes: Record<string, string> = {
      eventId: envelope.eventId,
      eventType,
    };
    if (correlationId) attributes.correlationId = correlationId;

    // Pub/Sub yêu cầu data dạng Buffer
    await topic.publishMessage({
      data: Buffer.from(JSON.stringify(envelope)),
      attributes,
    });
  }
}
