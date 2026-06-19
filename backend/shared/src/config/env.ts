// =============================================================================
// ENV HELPERS — Đọc biến môi trường an toàn (fail fast)
// =============================================================================
// Thay vì rải process.env.X ?? '' khắp nơi (lỗi im lặng khi thiếu config),
// đọc qua helper: thiếu biến bắt buộc → throw ngay lúc khởi động, dễ phát hiện.

/**
 * Lấy biến môi trường BẮT BUỘC. Thiếu → throw (fail fast lúc bootstrap).
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Biến môi trường "${name}" chưa được set`);
  }
  return value;
}

/**
 * Lấy biến môi trường TÙY CHỌN, có giá trị mặc định nếu thiếu.
 */
export function getEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/**
 * Lấy biến môi trường dạng số (vd: PORT). Thiếu/sai → trả fallback.
 */
export function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
