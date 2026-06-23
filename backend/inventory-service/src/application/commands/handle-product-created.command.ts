// =============================================================================
// HANDLE PRODUCT CREATED — Cross-context sync
// =============================================================================
// Receives product.created event → auto-create a StockItem with zero quantities.
// Idempotent: if a StockItem with matching SKU already exists, skip creation.

import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { type EventEnvelope, type ProductCreatedPayload } from '@erp/shared';

import { StockItem } from '../../domain/entities/index.js';
import {
  STOCK_ITEM_REPOSITORY,
  type IStockItemRepository,
} from '../../domain/repositories/index.js';

@Injectable()
export class HandleProductCreatedCommand {
  private readonly logger = new Logger(HandleProductCreatedCommand.name);

  constructor(
    @Inject(STOCK_ITEM_REPOSITORY) private readonly repo: IStockItemRepository,
  ) {}

  async execute(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as ProductCreatedPayload;
    const { sku, name } = payload;

    // Idempotent: skip if stock item already exists for this SKU
    const existing = await this.repo.findBySku(sku);
    if (existing) {
      this.logger.log(
        `StockItem for SKU "${sku}" already exists — skipping creation`,
      );
      return;
    }

    const now = new Date();
    const item = new StockItem({
      id: uuidv4(),
      sku,
      name,
      quantityAvailable: 0,
      quantityReserved: 0,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });

    await this.repo.create(item);

    this.logger.log(`✅ StockItem created for product SKU "${sku}"`);
  }
}
