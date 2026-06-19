// =============================================================================
// OUTBOX WORKER SERVICE — Background worker publish events lên Pub/Sub
// =============================================================================
// Worker này là phần thứ 2 của Outbox Pattern:
// 1. Repository ghi event vào bảng outbox (trong transaction với business data)
// 2. Worker (file này) poll bảng outbox, publish lên Pub/Sub, đánh dấu đã gửi
//
// Cơ chế hoạt động:
// - Mỗi 2 giây, query các event có published_at IS NULL (chưa gửi)
// - Lấy tối đa 10 event mỗi lần (batch nhỏ để tránh quá tải)
// - Với mỗi event: publish lên Google Cloud Pub/Sub topic tương ứng
// - Sau khi publish thành công: UPDATE published_at = NOW()
// - Nếu publish thất bại: log lỗi, bỏ qua, retry ở chu kỳ tiếp theo
//
// Đảm bảo "at-least-once delivery":
// - Event chỉ được đánh dấu published SAU KHI gửi thành công
// - Nếu crash giữa chừng → event chưa đánh dấu → sẽ được gửi lại
// - Consumer phía nhận phải idempotent (xử lý trùng lặp an toàn)

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import { PrismaService } from '../persistence/prisma.service.js';

/** Interval giữa các lần poll outbox (milliseconds) */
const POLL_INTERVAL_MS = 2_000;

/** Số lượng event tối đa lấy mỗi lần poll */
const BATCH_SIZE = 10;

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);

  /**
   * Google Cloud Pub/Sub client.
   * Khi PUBSUB_EMULATOR_HOST được set (dev env), tự động kết nối emulator.
   * Khi deploy production, sử dụng GCP credentials thực.
   */
  private readonly pubsub: PubSub;

  /** Handle của setInterval — cần để clearInterval khi shutdown */
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {
    // Khởi tạo Pub/Sub client với projectId từ env
    // Nếu PUBSUB_EMULATOR_HOST đã set, PubSub tự động dùng emulator
    this.pubsub = new PubSub({
      projectId: process.env.PUBSUB_PROJECT_ID ?? 'erp-prototype',
    });
  }

  /**
   * Bắt đầu polling khi module khởi tạo.
   * setInterval đảm bảo worker chạy liên tục trong background.
   */
  onModuleInit(): void {
    this.logger.log(
      `Outbox Worker bắt đầu — poll mỗi ${POLL_INTERVAL_MS}ms, batch size ${BATCH_SIZE}`,
    );

    this.pollInterval = setInterval(() => {
      // Gọi processOutbox và bắt lỗi ở đây
      // Nếu không catch, unhandled rejection sẽ crash process
      this.processOutbox().catch((error) => {
        this.logger.error('Lỗi không mong đợi trong processOutbox:', error);
      });
    }, POLL_INTERVAL_MS);
  }

  /**
   * Dừng polling khi module bị hủy (graceful shutdown).
   * Giải phóng timer để Node.js process có thể thoát sạch.
   */
  onModuleDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.logger.log('Outbox Worker đã dừng ✅');
    }
  }

  /**
   * Xử lý 1 batch outbox events:
   * 1. Query các event chưa publish (published_at IS NULL)
   * 2. Publish từng event lên Pub/Sub topic tương ứng
   * 3. Đánh dấu published_at = now() sau khi gửi thành công
   *
   * Mỗi event được xử lý độc lập — 1 event lỗi không ảnh hưởng event khác.
   */
  private async processOutbox(): Promise<void> {
    // Query các event chưa được publish, sắp xếp theo thời gian tạo (FIFO)
    const pendingEvents = await this.prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    // Không có event nào → thoát sớm, không log để tránh spam
    if (pendingEvents.length === 0) return;

    this.logger.debug(`Tìm thấy ${pendingEvents.length} event(s) cần publish`);

    // Xử lý từng event — không dùng Promise.all vì muốn kiểm soát lỗi từng event
    for (const event of pendingEvents) {
      try {
        await this.publishEvent(event.eventType, event.payload);

        // Đánh dấu event đã publish thành công
        await this.prisma.outbox.update({
          where: { id: event.id },
          data: { publishedAt: new Date() },
        });

        this.logger.log(
          `Published event: type="${event.eventType}", aggregateId="${event.aggregateId}"`,
        );
      } catch (error) {
        // Log lỗi và bỏ qua — event sẽ được retry ở chu kỳ tiếp theo
        // Không throw để các event khác trong batch vẫn được xử lý
        this.logger.error(
          `Lỗi publish event id="${event.id}", type="${event.eventType}":`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  /**
   * Publish 1 event lên Google Cloud Pub/Sub.
   *
   * Topic được tạo tự động (autoCreate: true) nếu chưa tồn tại.
   * eventType được dùng làm tên topic (vd: "customer.created" → topic "customer.created").
   *
   * @param eventType - Tên topic / loại event
   * @param payload   - Dữ liệu event dạng JSON
   */
  private async publishEvent(eventType: string, payload: unknown): Promise<void> {
    // Lấy reference tới topic, tạo mới nếu chưa có
    const topic = this.pubsub.topic(eventType);
    const [exists] = await topic.exists();

    if (!exists) {
      await topic.create();
      this.logger.log(`Tạo mới Pub/Sub topic: "${eventType}"`);
    }

    // Serialize payload thành Buffer (Pub/Sub yêu cầu dạng Buffer/string)
    const messageBuffer = Buffer.from(JSON.stringify(payload));

    // Publish message lên topic
    await topic.publishMessage({ data: messageBuffer });
  }
}
