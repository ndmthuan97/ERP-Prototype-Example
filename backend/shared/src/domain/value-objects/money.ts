// =============================================================================
// MONEY VALUE OBJECT — Immutable, currency-aware monetary value
// =============================================================================
// Enforces invariants: same currency for arithmetic ops.
// Uses number (prototype convention). For production: consider BigInt or Decimal.

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: cannot operate on "${a}" and "${b}"`);
    this.name = 'CurrencyMismatchError';
  }
}

export class Money {
  readonly amount: number;
  readonly currency: string;

  private constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency;
  }

  static create(amount: number, currency = 'VND'): Money {
    if (!Number.isFinite(amount)) {
      throw new Error('Money amount must be a finite number');
    }
    return new Money(amount, currency.toUpperCase());
  }

  static zero(currency = 'VND'): Money {
    return new Money(0, currency.toUpperCase());
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new Error('Multiplication factor must be a finite number');
    }
    return new Money(this.amount * factor, this.currency);
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount >= other.amount;
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
