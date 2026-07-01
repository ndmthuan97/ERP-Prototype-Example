// =============================================================================
// CREATE PO COMMAND — Create a new draft purchase order
// =============================================================================
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

import { PurchaseOrder } from "../../domain/entities/index.js";
import {
  PURCHASE_ORDER_REPOSITORY,
  type IPurchaseOrderRepository,
  SUPPLIER_REPOSITORY,
  type ISupplierRepository,
} from "../../domain/repositories/index.js";
import { validateCreatePO } from "../dtos/index.js";

@Injectable()
export class CreatePOCommand {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly repo: IPurchaseOrderRepository,
    @Inject(SUPPLIER_REPOSITORY)
    private readonly supplierRepo: ISupplierRepository,
  ) {}

  async execute(dto: unknown): Promise<PurchaseOrder> {
    const validated = validateCreatePO(dto);

    // Validate the supplier in the application layer so a bad supplierId gives a
    // clean 404/400 instead of a raw Prisma FK 500, and inactive suppliers are
    // rejected (the DB FK alone can't enforce isActive).
    const supplier = await this.supplierRepo.findById(validated.supplierId);
    if (!supplier) {
      throw new NotFoundException(
        `Supplier not found: "${validated.supplierId}"`,
      );
    }
    if (!supplier.isActive) {
      throw new BadRequestException(
        `Supplier "${validated.supplierId}" is inactive`,
      );
    }

    const order = PurchaseOrder.createDraft(uuidv4(), validated.supplierId);
    return this.repo.create(order);
  }
}
