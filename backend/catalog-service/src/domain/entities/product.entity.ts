// =============================================================================
// PRODUCT ENTITY — Aggregate Root of bounded context "Catalog"
// =============================================================================
// Product is the Aggregate Root managing product catalog data.
// Extends AggregateRoot from @erp/shared to support domain events.
// SKU is immutable after creation (enforced by readonly modifier).

import { AggregateRoot } from "@erp/shared";
import { SKU } from "@erp/shared";
import { EVENT } from "@erp/shared";

export interface ProductProps {
  id: string;
  sku: string;
  name: string;
  unit: string;
  defaultSalePrice: number;
  taxRate: number;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Product extends AggregateRoot {
  readonly id: string;
  readonly sku: string;
  name: string;
  unit: string;
  defaultSalePrice: number;
  taxRate: number;
  isActive: boolean;
  version: number;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: ProductProps) {
    super();
    this.id = props.id;
    this.sku = props.sku;
    this.name = props.name;
    this.unit = props.unit;
    this.defaultSalePrice = props.defaultSalePrice;
    this.taxRate = props.taxRate;
    this.isActive = props.isActive;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Product aggregate.
   * Validates SKU format via VO and enforces price >= 0.
   */
  static create(
    id: string,
    sku: string,
    name: string,
    unit: string,
    price: number,
    taxRate: number = 0.1,
  ): Product {
    // Validate SKU format via Value Object (throws if invalid)
    SKU.create(sku);

    if (!name || name.trim().length === 0) {
      throw new Error("Product name must not be empty");
    }
    if (price < 0) {
      throw new Error("Product price must be >= 0");
    }

    const validRates = [0, 0.05, 0.08, 0.1];
    if (!validRates.includes(taxRate)) {
      throw new Error("Tax rate must be one of: 0%, 5%, 8%, 10%");
    }

    const now = new Date();
    return new Product({
      id,
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      unit: unit || "PCS",
      defaultSalePrice: price,
      taxRate,
      isActive: true,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rename the product. Name must not be empty. */
  rename(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error("Product name must not be empty");
    }
    this.name = name.trim();
    this.touch();
  }

  /** Change the default sale price. Price must be >= 0. */
  changePrice(price: number): void {
    if (price < 0) {
      throw new Error("Product price must be >= 0");
    }
    this.defaultSalePrice = price;
    this.touch();
  }

  /** Change the tax rate. Must be one of: 0%, 5%, 8%, 10%. */
  changeTaxRate(rate: number): void {
    const validRates = [0, 0.05, 0.08, 0.1];
    if (!validRates.includes(rate)) {
      throw new Error("Tax rate must be one of: 0%, 5%, 8%, 10%");
    }
    this.taxRate = rate;
    this.touch();
  }

  /** Change the unit of measure. */
  changeUnit(unit: string): void {
    if (!unit || unit.trim().length === 0) {
      throw new Error("Product unit must not be empty");
    }
    this.unit = unit.trim();
    this.touch();
  }

  /** Activate the product. */
  activate(): void {
    this.isActive = true;
    this.touch();
  }

  /** Deactivate the product and raise a domain event. */
  deactivate(): void {
    this.isActive = false;
    this.touch();
    this.addDomainEvent({
      eventType: EVENT.PRODUCT_DEACTIVATED,
      occurredAt: new Date(),
      payload: { id: this.id, sku: this.sku, name: this.name },
    });
  }

  /** Update the updatedAt timestamp. */
  touch(): void {
    this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      sku: this.sku,
      name: this.name,
      unit: this.unit,
      defaultSalePrice: this.defaultSalePrice,
      taxRate: this.taxRate,
      isActive: this.isActive,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
