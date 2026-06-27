// =============================================================================
// GET SUPPLIER QUERY — Get a single supplier by ID
// =============================================================================
import { Injectable, Inject, NotFoundException } from '@nestjs/common';

import {
  SUPPLIER_REPOSITORY,
  type ISupplierRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class GetSupplierQuery {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly repo: ISupplierRepository,
  ) {}

  async execute(id: string) {
    const supplier = await this.repo.findById(id);
    if (!supplier) {
      throw new NotFoundException(`Supplier "${id}" not found`);
    }
    return supplier;
  }
}
