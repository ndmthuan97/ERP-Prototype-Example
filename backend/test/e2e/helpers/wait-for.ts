/**
 * E2E Test — Wait-For Helper
 *
 * Poll a condition until it resolves or timeout.
 * Used for saga completion (async via Pub/Sub).
 */

export interface WaitOptions {
  /** Poll interval in ms (default: 500) */
  interval?: number;
  /** Total timeout in ms (default: 10000) */
  timeout?: number;
  /** Description for error messages */
  description?: string;
}

/**
 * Poll `fn` every `interval` ms until it returns a truthy value.
 * Throws if timeout exceeded.
 */
export async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  options: WaitOptions = {},
): Promise<T> {
  const {
    interval = 500,
    timeout = 10000,
    description = 'condition',
  } = options;

  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(
    `waitFor("${description}") timed out after ${timeout}ms`,
  );
}

/**
 * Wait until GET request returns expected status field value.
 */
export async function waitForStatus(
  getFn: () => Promise<{ status: number; data: { status?: string } }>,
  expectedStatus: string,
  options: WaitOptions = {},
): Promise<void> {
  await waitFor(
    async () => {
      const res = await getFn();
      if (res.status === 200 && res.data.status === expectedStatus) {
        return true;
      }
      return false;
    },
    {
      ...options,
      description: options.description || `status=${expectedStatus}`,
    },
  );
}
