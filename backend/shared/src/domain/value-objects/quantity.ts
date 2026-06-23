// =============================================================================
// QUANTITY VALUE OBJECT — Non-negative integer quantity
// =============================================================================

export class Quantity {
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static create(value: number): Quantity {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Quantity must be a non-negative integer, got: ${value}`);
    }
    return new Quantity(value);
  }

  static zero(): Quantity {
    return new Quantity(0);
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.value + other.value);
  }

  subtract(other: Quantity): Quantity {
    const result = this.value - other.value;
    if (result < 0) {
      throw new Error(
        `Cannot subtract ${other.value} from ${this.value}: result would be negative`,
      );
    }
    return new Quantity(result);
  }

  isZero(): boolean {
    return this.value === 0;
  }

  isGreaterThan(other: Quantity): boolean {
    return this.value > other.value;
  }

  isGreaterThanOrEqual(other: Quantity): boolean {
    return this.value >= other.value;
  }

  equals(other: Quantity): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
