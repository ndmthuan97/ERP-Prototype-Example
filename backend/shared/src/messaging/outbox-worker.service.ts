// =============================================================================
// OUTBOX WORKER (GENERIC) — Background worker publish outbox events → Pub/Sub
// =============================================================================
// Đây là phần thứ 2 của Outbox Pattern, GENERIC cho mọi service:
// - Service nào cũng có bảng outbox → worker logic giống hệt nhau.
// - Thay vì copy-paste vào 5 service, đặt 1 lần ở đây.
//
// Dependency Inversion (SOLID "D"): worker KHÔNG biết Prisma. Nó chỉ phụ thuộc
// interface OutboxStore (đọc/đánh dấu published). Mỗi service tự cung cấp 1
// adapter Prisma nhỏ implement OutboxStore → worker dùng được với mọi schema.
//
// Cơ chế: mỗi POLL_INTERVAL_MS, lấy 1 batch event chưa publish, publish từng
// cái qua PubSubPublisher, đánh dấu published. Crash giữa chừng → event chưa
// đánh dấu → gửi lại ở chu kỳ sau (at-least-once → consumer phải idempotent).

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { PubSubPublisher } from './pubsub-publisher';
import { MetricsService } from '../observability/metrics';

/** 1 bản ghi outbox (đã chuẩn hoá, không phụ thuộc Prisma model cụ thể) */
export interface OutboxRecord {
  id: string;
  eventType: string;
  payload: unknown;
  aggregateId?: string | null;
  aggregateType?: string | null;
}

/**
 * Port (interface) cho việc truy cập bảng outbox.
 * Domain/worker chỉ biết interface này — implementation Prisma nằm ở service.
 */
export interface OutboxStore {
  /** Lấy tối đa `limit` event chưa publish, FIFO theo thời gian tạo */
  fetchUnpublished(limit: number): Promise<OutboxRecord[]>;
  /** Đánh dấu 1 event đã publish thành công */
  markPublished(id: string): Promise<void>;
}

/** DI token để service bind implementation cụ thể của OutboxStore */
export const OUTBOX_STORE = Symbol('OUTBOX_STORE');

/** Khoảng cách giữa các lần poll outbox (ms) */
const POLL_INTERVAL_MS = 2_000;

/** Số event tối đa xử lý mỗi lần poll */
const BATCH_SIZE = 10;

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);

  /** Handle setInterval — cần để clear khi shutdown */
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /** Cờ tránh 2 lần poll chồng lên nhau nếu 1 batch chạy lâu */
  private isProcessing = false;

  constructor(
    @Inject(OUTBOX_STORE) private readonly store: OutboxStore,
    private readonly publisher: PubSubPublisher,
    // Metrics là tùy chọn — không có cũng chạy (Optional injection)
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `Outbox Worker bắt đầu — poll mỗi ${POLL_INTERVAL_MS}ms, batch ${BATCH_SIZE}`,
    );

    this.pollInterval = setInterval(() => {
      // Bắt lỗi tại đây để unhandled rejection không crash process
      this.processOutbox().catch((error) => {
        this.logger.error('Lỗi không mong đợi trong processOutbox:', error);
      });
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.logger.log('Outbox Worker đã dừng ✅');
    }
  }

  /**
   * Xử lý 1 batch: lấy event chưa publish → publish → đánh dấu published.
   * Mỗi event độc lập — 1 event lỗi không chặn các event khác.
   */
  private async processOutbox(): Promise<void> {
    // Guard: nếu batch trước chưa xong thì bỏ qua lần này (tránh xử lý trùng)
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pending = await this.store.fetchUnpublished(BATCH_SIZE);
      if (pending.length === 0) return;

      this.logger.debug(`Tìm thấy ${pending.length} event cần publish`);

      // Cập nhật gauge "số event đang tồn đọng" để quan sát outbox lag
      this.metrics?.setGauge('outbox_pending', pending.length);

      for (const event of pending) {
        try {
          await this.publisher.publish(event.eventType, event.payload);
          await this.store.markPublished(event.id);

          this.metrics?.inc('events_published_total', { event: event.eventType });
          this.logger.log(
            `Published: type="${event.eventType}", aggregateId="${event.aggregateId ?? '-'}"`,
          );
        } catch (error) {
          // Log và bỏ qua — event sẽ được retry ở chu kỳ tiếp theo
          this.metrics?.inc('events_publish_failed_total', { event: event.eventType });
          this.logger.error(
            `Lỗi publish event id="${event.id}", type="${event.eventType}":`,
            error instanceof Error ? error.message : error,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
