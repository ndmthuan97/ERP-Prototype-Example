// =============================================================================
// CREATE SUPPLIER COMMAND — Create a new supplier
// =============================================================================
import { Injectable, Inject } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { Supplier } from "../../domain/entities/index.js";
import {
  SUPPLIER_REPOSITORY,
  type ISupplierRepository,
} from "../../domain/repositories/index.js";
import { validateCreateSupplier } from "../dtos/index.js";

@Injectable()
export class CreateSupplierCommand {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly repo: ISupplierRepository,
  ) {}

  async execute(dto: unknown): Promise<Supplier> {
    const validated = validateCreateSupplier(dto);
    const supplier = Supplier.create(uuidv4(), validated.name, {
      taxCode: validated.taxCode,
      contactName: validated.contactName,
      contactPhone: validated.contactPhone,
      contactEmail: validated.contactEmail,
      paymentTermDays: validated.paymentTermDays,
    });
    return this.repo.save(supplier);
  }
}
