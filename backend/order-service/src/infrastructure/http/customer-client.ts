// =============================================================================
// CUSTOMER CLIENT — HTTP đồng bộ gọi customer-service để credit-check
// =============================================================================
// Saga step 3a: sau khi inventory reserved → gọi HTTP credit-check.
// Coupling đồng bộ duy nhất giữa 2 service — CHỦ Ý demo cả 2 kiểu giao tiếp
// (event + HTTP) trong 1 saga.

import { Injectable, Logger } from '@nestjs/common';

export interface CreditCheckResult {
  creditLimit: number;
  creditUsed: number;
  available: number;
  sufficient: boolean;
}

const CUSTOMER_SERVICE_URL =
  process.env.CUSTOMER_SERVICE_URL ?? 'http://localhost:3001';
const TIMEOUT_MS = 5000;

@Injectable()
export class CustomerClient {
  private readonly logger = new Logger(CustomerClient.name);

  /**
   * Gọi customer-service credit-check endpoint.
   * @returns CreditCheckResult hoặc throw nếu customer không tồn tại / timeout.
   */
  async checkCredit(
    customerId: string,
    orderAmount: number,
  ): Promise<CreditCheckResult> {
    const url = `${CUSTOMER_SERVICE_URL}/customers/${customerId}/credit-check`;
    this.logger.log(
      `Credit check: customer="${customerId}", amount=${orderAmount}`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Credit check failed: HTTP ${response.status} — ${body}`,
        );
      }

      const data = (await response.json()) as {
        creditLimit: number;
        creditUsed: number;
        available: number;
      };

      const sufficient = data.available >= orderAmount;
      this.logger.log(
        `Credit check result: available=${data.available}, needed=${orderAmount}, sufficient=${sufficient}`,
      );

      return { ...data, sufficient };
    } finally {
      clearTimeout(timeout);
    }
  }
}
