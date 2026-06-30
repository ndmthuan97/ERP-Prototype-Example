// =============================================================================
// API ERROR — standardize BE errors into a single type for the entire FE
// =============================================================================
// BE (ZodExceptionFilter) returns 400 as:
//   { statusCode, error, message, issues: [{ path, message }] }
// 409 = conflict (taxCode/sku). 404 = not found.

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
   * Map issues[] → { fieldName: message } for Ant Design Form
   * (form.setFields). path "creditLimitAmount" matches field name in form.
   */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of this.issues) {
      if (issue.path) out[issue.path] = issue.message;
    }
    return out;
  }
}

// English user-facing messages mapped by HTTP status
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Invalid data. Please check your input.',
  401: 'Invalid email or password.',
  403: 'You do not have permission to perform this action.',
  404: 'Data not found.',
  409: 'Data already exists. Please check your input.',
  422: 'Invalid data.',
  429: 'Too many requests. Please try again later.',
  500: 'System error. Please try again later.',
  502: 'Cannot connect to server. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
  504: 'Server took too long to respond. Please try again later.',
};

// Known BE error messages → English translations
const ERROR_TRANSLATIONS: Record<string, string> = {
  'Invalid email or password': 'Invalid email or password.',
  'Invalid credentials': 'Invalid email or password.',
  'User account is inactive': 'Account has been deactivated. Contact your administrator.',
  'Missing or invalid Authorization header': 'Session expired. Please log in again.',
  'Invalid or expired token': 'Session expired. Please log in again.',
};

/** Concise message for toast/notification display — English, user-friendly. */
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
    return 'Cannot connect to server. Please check your network connection.';
  }

  if (err instanceof Error) return err.message;
  return 'An error occurred. Please try again.';
}

/** Get status-based default message. */
export function statusMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? `Unknown error (HTTP ${status})`;
}
