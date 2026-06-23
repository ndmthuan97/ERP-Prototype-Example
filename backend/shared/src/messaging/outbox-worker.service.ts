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
  /** Số lần đã thử publish (dùng cho retry/DLQ) */
  attempts?: number;
}

/**
 * Port (interface) cho việc truy cập bảng outbox.
 * Domain/worker chỉ biết interface này — implementation Prisma nằm ở service.
 */
export interface OutboxStore {
  /**
   * CLAIM (không chỉ đọc) tối đa `limit` event chưa publish, FIFO theo thời gian tạo.
   * Implementation phải an toàn khi chạy NHIỀU instance: dùng `FOR UPDATE SKIP LOCKED`
   * + đặt khoá tạm (locked_until) để 2 worker không lấy trùng 1 event.
   */
  fetchUnpublished(limit: number): Promise<OutboxRecord[]>;
  /** Đánh dấu 1 event đã publish thành công (set published_at, nhả khoá) */
  markPublished(id: string): Promise<void>;
  /**
   * Đánh dấu publish thất bại: tăng attempts, lưu lastError, nhả khoá để retry.
   * Khi attempts >= maxAttempts → chuyển dead-letter (set dead_lettered_at) để
   * KHÔNG retry vô hạn 1 "poison event".
   */
  markFailed(id: string, error: string, maxAttempts: number): Promise<void>;
  /** Đếm số event đang tồn đọng (chưa publish, chưa dead-letter) — cho gauge. */
  countPending(): Promise<number>;
}

/** DI token để service bind implementation cụ thể của OutboxStore */
export const OUTBOX_STORE = Symbol('OUTBOX_STORE');

/** Khoảng cách giữa các lần poll outbox (ms) */
const POLL_INTERVAL_MS = 2_000;

/** Số event tối đa xử lý mỗi lần poll */
const BATCH_SIZE = 10;

/** Số lần thử publish tối đa trước khi chuyển dead-letter */
const MAX_ATTEMPTS = 5;

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
      `Outbox Worker started — polling every ${POLL_INTERVAL_MS}ms, batch size ${BATCH_SIZE}`,
    );

    this.pollInterval = setInterval(() => {
      // Bắt lỗi tại đây để unhandled rejection không crash process
      this.processOutbox().catch((error) => {
        this.logger.error('Unexpected error in processOutbox:', error);
      });
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.logger.log('Outbox Worker stopped');
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
      // Gauge phản ánh TỔNG tồn đọng thật (COUNT), không phải kích thước batch.
      // (Bản cũ set = pending.length ≤ BATCH_SIZE → luôn ≤ 10, vô dụng để cảnh báo.)
      this.metrics?.setGauge('outbox_pending', await this.store.countPending());

      // CLAIM 1 batch (SKIP LOCKED) — an toàn khi chạy nhiều instance
      const pending = await this.store.fetchUnpublished(BATCH_SIZE);
      if (pending.length === 0) return;

      this.logger.debug(`Claimed ${pending.length} event(s) to publish`);

      for (const event of pending) {
        try {
          await this.publisher.publish(event.eventType, event.payload, {
            // eventId = id dòng outbox → khoá dedup ổn định cho consumer
            eventId: event.id,
            // correlationId được lưu trong payload (_meta) lúc ghi outbox,
            // vì worker chạy NGOÀI request gốc nên không đọc được từ context.
            correlationId: extractCorrelationId(event.payload),
          });
          await this.store.markPublished(event.id);

          this.metrics?.inc('events_published_total', { event: event.eventType });
          this.logger.log(
            `Published: type="${event.eventType}", eventId="${event.id}", aggregateId="${event.aggregateId ?? '-'}"`,
          );
        } catch (error) {
          // Tăng attempts + nhả khoá để retry; quá ngưỡng → dead-letter.
          const message = error instanceof Error ? error.message : String(error);
          this.metrics?.inc('events_publish_failed_total', { event: event.eventType });
          this.logger.error(
            `Failed to publish event id="${event.id}", type="${event.eventType}" (attempt ${(event.attempts ?? 0) + 1}/${MAX_ATTEMPTS}):`,
            message,
          );
          try {
            await this.store.markFailed(event.id, message, MAX_ATTEMPTS);
            if ((event.attempts ?? 0) + 1 >= MAX_ATTEMPTS) {
              this.metrics?.inc('events_dead_lettered_total', { event: event.eventType });
              this.logger.error(
                `Event id="${event.id}" moved to DEAD-LETTER after ${MAX_ATTEMPTS} failed attempts`,
              );
            }
          } catch (markErr) {
            this.logger.error(
              `Failed to markFailed event id="${event.id}":`,
              markErr instanceof Error ? markErr.message : markErr,
            );
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

/**
 * Trích correlationId từ payload đã lưu trong outbox (_meta.correlationId).
 * Trả null nếu không có — worker chạy ngoài request nên không có context.
 */
function extractCorrelationId(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && '_meta' in payload) {
    const meta = (payload as { _meta?: { correlationId?: string | null } })._meta;
    return meta?.correlationId ?? null;
  }
  return null;
}
