// =============================================================================
// SUPPLIER ENTITY — Domain entity in the Purchasing bounded context
// =============================================================================
// Represents a vendor/supplier from whom the company purchases goods.
// Simple entity with activate/deactivate lifecycle.

export interface SupplierProps {
  id: string;
  name: string;
  taxCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTermDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Supplier {
  readonly id: string;
  name: string;
  taxCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTermDays: number;
  isActive: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: SupplierProps) {
    this.id = props.id;
    this.name = props.name;
    this.taxCode = props.taxCode;
    this.contactName = props.contactName;
    this.contactPhone = props.contactPhone;
    this.contactEmail = props.contactEmail;
    this.paymentTermDays = props.paymentTermDays;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  activate(): void {
    this.isActive = true;
    this.touch();
  }

  deactivate(): void {
    this.isActive = false;
    this.touch();
  }

  update(changes: {
    name?: string;
    taxCode?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    paymentTermDays?: number;
  }): void {
    if (changes.name !== undefined) {
      if (!changes.name || changes.name.trim().length === 0) {
        throw new Error('Supplier name must not be empty');
      }
      this.name = changes.name.trim();
    }
    if (changes.taxCode !== undefined) this.taxCode = changes.taxCode;
    if (changes.contactName !== undefined) this.contactName = changes.contactName;
    if (changes.contactPhone !== undefined) this.contactPhone = changes.contactPhone;
    if (changes.contactEmail !== undefined) this.contactEmail = changes.contactEmail;
    if (changes.paymentTermDays !== undefined) {
      if (changes.paymentTermDays < 0) {
        throw new Error('Payment term days must be >= 0');
      }
      this.paymentTermDays = changes.paymentTermDays;
    }
    this.touch();
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  static create(
    id: string,
    name: string,
    options?: {
      taxCode?: string | null;
      contactName?: string | null;
      contactPhone?: string | null;
      contactEmail?: string | null;
      paymentTermDays?: number;
    },
  ): Supplier {
    if (!name || name.trim().length === 0) {
      throw new Error('Supplier name must not be empty');
    }

    const now = new Date();
    return new Supplier({
      id,
      name: name.trim(),
      taxCode: options?.taxCode ?? null,
      contactName: options?.contactName ?? null,
      contactPhone: options?.contactPhone ?? null,
      contactEmail: options?.contactEmail ?? null,
      paymentTermDays: options?.paymentTermDays ?? 30,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}
