// =============================================================================
// STRUCTURED LOGGER — Log JSON có correlationId, cắm vào NestJS
// =============================================================================
// Vì sao không dùng console.log mặc định?
// - Log JSON (structured) dễ filter/aggregate hơn text thường (ELK, Loki...).
// - Tự đính correlationId từ AsyncLocalStorage → mỗi dòng log biết thuộc luồng nào.
//
// Implement LoggerService của NestJS → cắm bằng app.useLogger(new StructuredLogger()).
// (Production có thể thay bằng pino/nestjs-pino — interface vẫn vậy, zero đổi call site.)

import { LoggerService } from '@nestjs/common';
import { getCorrelationId } from './correlation';

/** Cấu trúc 1 dòng log JSON */
interface LogEntry {
  level: string;
  time: string;
  context?: string;
  correlationId?: string;
  msg: string;
  stack?: string;
}

export class StructuredLogger implements LoggerService {
  /**
   * Ghi 1 dòng log JSON xuống stdout/stderr.
   * Tự lấy correlationId của ngữ cảnh hiện tại (nếu đang trong 1 request).
   */
  private write(
    level: string,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      context,
      correlationId: getCorrelationId(),
      msg: typeof message === 'string' ? message : JSON.stringify(message),
      stack,
    };

    const line = JSON.stringify(entry) + '\n';

    // error/warn ra stderr, còn lại ra stdout — tiện tách luồng khi thu thập log
    if (level === 'error' || level === 'warn') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
}
