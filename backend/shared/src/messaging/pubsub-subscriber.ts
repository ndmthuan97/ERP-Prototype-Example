// =============================================================================
// PUBSUB SUBSCRIBER — Pull-based consumer dùng chung mọi service
// =============================================================================
// Đối xứng với PubSubPublisher: Publisher lo PUBLISH, Subscriber lo CONSUME.
// Mỗi service đăng ký handler cho từng topic, Subscriber lo:
//   1. Tạo subscription (autoCreate) nếu chưa có
//   2. Pull message, parse EventEnvelope
//   3. Bọc handler bằng withIdempotency (dedup at-least-once)
//   4. Propagate correlationId vào AsyncLocalStorage (truy vết xuyên saga)
//   5. ack/nack tự động
//
// An toàn khi chạy nhiều instance: Pub/Sub tự phân phối message giữa các
// consumer cùng subscription (competing consumers).

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PubSub, type Subscription, type Message } from '@google-cloud/pubsub';
import { Redis } from '@upstash/redis';
import { type EventEnvelope } from '../contracts/events';
import { withIdempotency } from './idempotency';
import { runWithCorrelation } from '../observability/correlation';

/** Đăng ký 1 handler cho 1 topic */
export interface SubscriptionRegistration {
  /** Tên topic Pub/Sub (vd: 'inventory.reserved') */
  topic: string;
  /** Tên subscription — convention: <service>.<topic> (vd: 'order-service.inventory.reserved') */
  subscription: string;
  /** Hàm xử lý event — nhận envelope đã parse */
  handler: (envelope: EventEnvelope) => Promise<void>;
}

@Injectable()
export class PubSubSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PubSubSubscriber.name);
  private readonly pubsub: PubSub;
  private readonly redis: Redis;

  /** Danh sách subscription instances đang active — close khi shutdown */
  private activeSubscriptions: Subscription[] = [];

  /** Handler đăng ký trước khi init — tích lũy qua register() */
  private registrations: SubscriptionRegistration[] = [];

  constructor() {
    this.pubsub = new PubSub({
      projectId: process.env.PUBSUB_PROJECT_ID ?? 'erp-prototype',
    });
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    });
  }

  /**
   * Đăng ký handler cho 1 topic. Gọi TRƯỚC onModuleInit (trong constructor
   * của service/module). Handler sẽ bắt đầu nhận message khi init xong.
   */
  register(reg: SubscriptionRegistration): void {
    this.registrations.push(reg);
  }

  async onModuleInit(): Promise<void> {
    // Chỉ subscribe nếu PUBSUB_EMULATOR_HOST hoặc credential đã set
    if (!process.env.PUBSUB_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.logger.warn('Pub/Sub not configured — subscriber DISABLED');
      return;
    }

    for (const reg of this.registrations) {
      await this.startListening(reg);
    }
  }

  onModuleDestroy(): void {
    for (const sub of this.activeSubscriptions) {
      sub.close();
    }
    this.activeSubscriptions = [];
    this.logger.log('All Pub/Sub subscriptions closed');
  }

  private async startListening(reg: SubscriptionRegistration): Promise<void> {
    const topic = this.pubsub.topic(reg.topic);

    // Auto-create topic nếu chưa tồn tại (dev convenience)
    const [topicExists] = await topic.exists();
    if (!topicExists) {
      await topic.create();
      this.logger.log(`Created new topic: "${reg.topic}"`);
    }

    // Auto-create subscription nếu chưa tồn tại
    const subscription = topic.subscription(reg.subscription);
    const [subExists] = await subscription.exists();
    if (!subExists) {
      await subscription.create();
      this.logger.log(`Created new subscription: "${reg.subscription}" → topic "${reg.topic}"`);
    }

    // Bắt đầu lắng nghe (pull-based streaming)
    subscription.on('message', (message: Message) => {
      this.handleMessage(message, reg.handler).catch((err) => {
        this.logger.error(
          `Unhandled error in subscription "${reg.subscription}":`,
          err instanceof Error ? err.message : err,
        );
      });
    });

    subscription.on('error', (err: Error) => {
      this.logger.error(`Subscription "${reg.subscription}" error: ${err.message}`);
    });

    this.activeSubscriptions.push(subscription);
    this.logger.log(`Listening: "${reg.subscription}" ← topic "${reg.topic}"`);
  }

  /**
   * Xử lý 1 message: parse envelope → idempotency check → propagate correlationId → handler.
   */
  private async handleMessage(
    message: Message,
    handler: (envelope: EventEnvelope) => Promise<void>,
  ): Promise<void> {
    let envelope: EventEnvelope;
    try {
      envelope = JSON.parse(message.data.toString()) as EventEnvelope;
    } catch {
      // Message không parse được → dead message, ack luôn để không block queue
      this.logger.error(`Message is not valid JSON — ack to skip (id=${message.id})`);
      message.ack();
      return;
    }

    // eventId từ envelope (= id dòng outbox, ổn định) — ưu tiên hơn message.id
    const eventId = envelope.eventId ?? message.id;

    try {
      // Bọc handler trong withIdempotency + correlationId propagation
      const processed = await withIdempotency(this.redis, eventId, async () => {
        const correlationId = envelope.correlationId ?? undefined;
        if (correlationId) {
          // Chạy handler bên trong ngữ cảnh có correlationId → log nối tiếp saga
          await runWithCorrelation(correlationId, () => handler(envelope));
        } else {
          await handler(envelope);
        }
      });

      if (processed) {
        this.logger.log(
          `✅ Processed: type="${envelope.eventType}", eventId="${eventId}"`,
        );
      } else {
        this.logger.debug(
          `⏭️ Duplicate skip: type="${envelope.eventType}", eventId="${eventId}"`,
        );
      }
      message.ack();
    } catch (err) {
      // Handler lỗi → nack để Pub/Sub redeliver (withIdempotency đã xoá key)
      this.logger.error(
        `Handler error: type="${envelope.eventType}", eventId="${eventId}" — nack for retry`,
        err instanceof Error ? err.message : err,
      );
      message.nack();
    }
  }
}
