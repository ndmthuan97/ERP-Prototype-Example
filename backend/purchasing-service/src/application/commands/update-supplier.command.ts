// =============================================================================
// UPDATE SUPPLIER COMMAND — Update an existing supplier
// =============================================================================
import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  SUPPLIER_REPOSITORY,
  type ISupplierRepository,
} from '../../domain/repositories/index.js';
import { validateUpdateSupplier } from '../dtos/index.js';

@Injectable()
export class UpdateSupplierCommand {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly repo: ISupplierRepository,
  ) {}

  async execute(id: string, dto: unknown) {
    const validated = validateUpdateSupplier(dto);
    const supplier = await this.repo.findById(id);

    if (!supplier) {
      throw new NotFoundException(`Supplier "${id}" not found`);
    }

    // Handle activation/deactivation separately
    if (validated.isActive === true) {
      supplier.activate();
    } else if (validated.isActive === false) {
      supplier.deactivate();
    }

    // Apply other field updates
    const { isActive, ...changes } = validated;
    if (Object.keys(changes).length > 0) {
      supplier.update(changes);
    }

    return this.repo.update(supplier);
  }
}
