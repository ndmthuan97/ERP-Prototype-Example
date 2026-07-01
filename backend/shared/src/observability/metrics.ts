// =============================================================================
// METRICS — Counter/Gauge + endpoint /metrics theo định dạng Prometheus
// =============================================================================
// Tự cài 1 registry tối giản (zero dependency) để HỌC rõ Prometheus exposition
// format. Production nên thay bằng `prom-client` — cùng khái niệm counter/gauge,
// chỉ khác là lib lo sẵn histogram/summary/label cardinality.
//
// Counter: chỉ tăng (vd: events_published_total). Gauge: tăng/giảm (vd: outbox_pending).
// Mỗi metric có thể kèm labels (vd: {event="customer.created"}) → nhiều series.

import {
  Injectable,
  Controller,
  Get,
  Header,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';

/** Loại metric hỗ trợ */
type MetricType = 'counter' | 'gauge';

/** Trạng thái 1 metric: help text + các series theo bộ label */
interface MetricState {
  help: string;
  type: MetricType;
  /** key = chuỗi label đã chuẩn hoá, value = số đo hiện tại */
  series: Map<string, number>;
}

@Injectable()
export class MetricsService {
  /** name → trạng thái metric */
  private readonly metrics = new Map<string, MetricState>();

  /** Lấy (hoặc tạo) 1 metric theo tên + loại */
  private ensure(name: string, type: MetricType, help: string): MetricState {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = { help: help || name, type, series: new Map() };
      this.metrics.set(name, metric);
    }
    return metric;
  }

  /**
   * Chuẩn hoá labels thành chuỗi ổn định (sort theo key) làm khoá series.
   * vd: { event: 'a', status: 'ok' } → 'event="a",status="ok"'
   */
  private labelKey(labels: Record<string, string>): string {
    const keys = Object.keys(labels).sort();
    return keys
      .map((k) => `${k}="${this.escapeLabelValue(labels[k])}"`)
      .join(',');
  }

  /**
   * Escape a Prometheus label value: backslash, double-quote and newline must
   * be escaped, otherwise a value containing `"` or `\n` (e.g. an error string)
   * produces invalid exposition text and breaks the entire /metrics scrape.
   */
  private escapeLabelValue(value: string): string {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  /**
   * Tăng 1 counter (mặc định +1).
   */
  inc(
    name: string,
    labels: Record<string, string> = {},
    value = 1,
    help = '',
  ): void {
    const metric = this.ensure(name, 'counter', help);
    const key = this.labelKey(labels);
    metric.series.set(key, (metric.series.get(key) ?? 0) + value);
  }

  /**
   * Set giá trị 1 gauge (ghi đè, vì gauge phản ánh trạng thái hiện tại).
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {},
    help = '',
  ): void {
    const metric = this.ensure(name, 'gauge', help);
    metric.series.set(this.labelKey(labels), value);
  }

  /**
   * Kết xuất toàn bộ metrics theo Prometheus text exposition format:
   *   # HELP name help
   *   # TYPE name counter
   *   name{label="v"} value
   */
  render(): string {
    const lines: string[] = [];

    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      for (const [labelKey, value] of metric.series) {
        const labelPart = labelKey ? `{${labelKey}}` : '';
        lines.push(`${name}${labelPart} ${value}`);
      }
    }

    // Prometheus yêu cầu kết thúc bằng newline
    return lines.join('\n') + '\n';
  }
}

/**
 * Controller expose GET /metrics cho Prometheus scrape (hoặc `curl` khi học).
 */
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * GET /metrics — Prometheus scrape.
   *
   * Bảo vệ tùy chọn: nếu env METRICS_TOKEN được set, bắt buộc header
   * `Authorization: Bearer <token>` (tránh lộ nội tại ra public). Không set
   * (dev) → mở để dễ `curl`. Production NÊN set token + chặn ở network layer.
   */
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape(@Headers('authorization') authHeader?: string): string {
    const token = process.env.METRICS_TOKEN;
    if (token && authHeader !== `Bearer ${token}`) {
      throw new UnauthorizedException('Metrics endpoint yêu cầu token hợp lệ');
    }
    return this.metrics.render();
  }
}
