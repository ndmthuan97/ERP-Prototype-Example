// =============================================================================
// API ERROR — chuẩn hoá lỗi BE thành 1 kiểu duy nhất cho toàn FE
// =============================================================================
// BE (ZodExceptionFilter) trả 400 dạng:
//   { statusCode, error, message, issues: [{ path, message }] }
// 409 = trùng (taxCode/sku). 404 = không tìm thấy.

export interface ApiIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues: ApiIssue[] = [],
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isValidation(): boolean {
    return this.status === 400;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Map issues[] → { fieldName: message } để gắn vào Ant Design Form
   * (form.setFields). path "creditLimitAmount" khớp tên field trong form.
   */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of this.issues) {
      if (issue.path) out[issue.path] = issue.message;
    }
    return out;
  }
}

// Vietnamese user-facing messages mapped by HTTP status
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
  401: 'Sai email hoặc mật khẩu.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu.',
  409: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.',
  422: 'Dữ liệu không hợp lệ.',
  429: 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
  500: 'Lỗi hệ thống. Vui lòng thử lại sau.',
  502: 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.',
  503: 'Dịch vụ tạm ngưng hoạt động. Vui lòng thử lại sau.',
  504: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại sau.',
};

// Known BE error messages → Vietnamese translations
const ERROR_TRANSLATIONS: Record<string, string> = {
  'Invalid email or password': 'Sai email hoặc mật khẩu.',
  'Invalid credentials': 'Sai email hoặc mật khẩu.',
  'User account is inactive': 'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.',
  'Missing or invalid Authorization header': 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
  'Invalid or expired token': 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
};

/** Thông điệp gọn để hiển thị toast/message — Vietnamese, user-friendly. */
export function toMessage(err: unknown): string {
  if (err instanceof ApiError) {
    // Prioritize translated BE messages
    const translated = ERROR_TRANSLATIONS[err.message];
    if (translated) return translated;

    // Validation issues → join all issue messages
    if (err.issues.length) return err.issues.map((i) => i.message).join('; ');

    // Fallback to status-based message if BE message is generic
    const statusMsg = STATUS_MESSAGES[err.status];
    if (statusMsg && (err.message.startsWith('HTTP ') || err.message === 'Bad Request')) {
      return statusMsg;
    }

    return err.message;
  }

  // Network errors
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
  }

  if (err instanceof Error) return err.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

/** Get status-based default message. */
export function statusMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? `Lỗi không xác định (HTTP ${status})`;
}
