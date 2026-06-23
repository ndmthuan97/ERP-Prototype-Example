// =============================================================================
// SKU VALUE OBJECT — Stock Keeping Unit identifier
// =============================================================================
// Format: alphanumeric + hyphens, 3-30 chars. Case-insensitive (stored uppercase).

const SKU_REGEX = /^[A-Z0-9][A-Z0-9-]{1,28}[A-Z0-9]$/;

export class SKU {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(value: string): SKU {
    const normalized = value.trim().toUpperCase();
    if (!SKU_REGEX.test(normalized)) {
      throw new Error(
        `Invalid SKU "${value}": must be 3-30 chars, alphanumeric + hyphens, ` +
          `cannot start or end with hyphen`,
      );
    }
    return new SKU(normalized);
  }

  equals(other: SKU): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
