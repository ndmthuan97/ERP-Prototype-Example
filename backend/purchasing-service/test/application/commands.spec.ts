// =============================================================================
// UNIT TEST — Application Commands
// =============================================================================
// Tests command handlers with mocked repository.

import {
  PurchaseOrder,
  PurchaseOrderLine,
} from '../../src/domain/entities';
import type { IPurchaseOrderRepository } from '../../src/domain/repositories';
import { CreatePOCommand } from '../../src/application/commands/create-po.command';
import { AddLinePOCommand } from '../../src/application/commands/add-line-po.command';
import { RemoveLinePOCommand } from '../../src/application/commands/remove-line-po.command';
import { PlacePOCommand } from '../../src/application/commands/place-po.command';
import { ReceiveGoodsCommand } from '../../src/application/commands/receive-goods.command';
import { CancelPOCommand } from '../../src/application/commands/cancel-po.command';
import { NotFoundException } from '@nestjs/common';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function mockRepo(): IPurchaseOrderRepository {
  return {
    findById: jest.fn(),
    search: jest.fn(),
    create: jest.fn((order) => Promise.resolve(order)),
    save: jest.fn((order) => Promise.resolve(order)),
    addLine: jest.fn((order) => Promise.resolve(order)),
    removeLine: jest.fn(() => Promise.resolve()),
  };
}

function makePO(
  overrides: Partial<{
    status: string;
    lines: PurchaseOrderLine[];
  }> = {},
): PurchaseOrder {
  return new PurchaseOrder({
    id: 'po-1',
    supplierId: 'sup-1',
    status: (overrides.status ?? 'draft') as any,
    version: 0,
    lines: overrides.lines ?? [],
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function makeLine(id = 'line-1'): PurchaseOrderLine {
  return new PurchaseOrderLine({
    id,
    productId: 'prod-1',
    productName: 'Widget',
    orderedQty: 100,
    receivedQty: 0,
    unitCost: 50,
  });
}

describe('CreatePOCommand', () => {
  it('creates a draft PO with valid input', async () => {
    const repo = mockRepo();
    const cmd = new CreatePOCommand(repo);

    const result = await cmd.execute({ supplierId: 'sup-1' });
    expect(result.status).toBe('draft');
    expect(result.supplierId).toBe('sup-1');
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('throws ZodError on invalid input', async () => {
    const repo = mockRepo();
    const cmd = new CreatePOCommand(repo);

    await expect(cmd.execute({})).rejects.toThrow();
  });
});

describe('AddLinePOCommand', () => {
  it('adds a line to an existing draft PO', async () => {
    const repo = mockRepo();
    const po = makePO();
    (repo.findById as jest.Mock).mockResolvedValue(po);

    const cmd = new AddLinePOCommand(repo);
    await cmd.execute('po-1', {
      productId: 'prod-1',
      productName: 'Widget A',
      orderedQty: 10,
      unitCost: 100,
    });

    expect(repo.addLine).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when PO not found', async () => {
    const repo = mockRepo();
    (repo.findById as jest.Mock).mockResolvedValue(null);

    const cmd = new AddLinePOCommand(repo);
    await expect(
      cmd.execute('unknown', {
        productId: 'p',
        productName: 'X',
        orderedQty: 1,
        unitCost: 10,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('RemoveLinePOCommand', () => {
  it('removes a line from a draft PO', async () => {
    const repo = mockRepo();
    const po = makePO({ lines: [makeLine()] });
    (repo.findById as jest.Mock).mockResolvedValue(po);

    const cmd = new RemoveLinePOCommand(repo);
    await cmd.execute('po-1', 'line-1');

    expect(repo.removeLine).toHaveBeenCalledWith('po-1', 'line-1');
  });
});

describe('PlacePOCommand', () => {
  it('places a draft PO with lines', async () => {
    const repo = mockRepo();
    const po = makePO({ lines: [makeLine()] });
    (repo.findById as jest.Mock).mockResolvedValue(po);

    const cmd = new PlacePOCommand(repo);
    await cmd.execute('po-1');

    expect(repo.save).toHaveBeenCalledTimes(1);
    const savedOrder = (repo.save as jest.Mock).mock.calls[0][0];
    expect(savedOrder.status).toBe('placed');
  });

  it('throws NotFoundException when PO not found', async () => {
    const repo = mockRepo();
    (repo.findById as jest.Mock).mockResolvedValue(null);

    const cmd = new PlacePOCommand(repo);
    await expect(cmd.execute('unknown')).rejects.toThrow(NotFoundException);
  });
});

describe('ReceiveGoodsCommand', () => {
  it('receives goods and transitions to partially_received', async () => {
    const repo = mockRepo();
    const po = makePO({ status: 'placed', lines: [makeLine()] });
    (repo.findById as jest.Mock).mockResolvedValue(po);

    const cmd = new ReceiveGoodsCommand(repo);
    await cmd.execute('po-1', {
      receipts: [{ lineId: 'line-1', quantity: 50 }],
    });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const savedOrder = (repo.save as jest.Mock).mock.calls[0][0];
    expect(savedOrder.status).toBe('partially_received');
  });

  it('passes outbox events for goods.received', async () => {
    const repo = mockRepo();
    const po = makePO({ status: 'placed', lines: [makeLine()] });
    (repo.findById as jest.Mock).mockResolvedValue(po);

    const cmd = new ReceiveGoodsCommand(repo);
    await cmd.execute('po-1', {
      receipts: [{ lineId: 'line-1', quantity: 100 }],
    });

    const outboxEvents = (repo.save as jest.Mock).mock.calls[0][1];
    expect(outboxEvents).toHaveLength(1);
    expect(outboxEvents[0].eventType).toBe('goods.received');
  });
});

describe('CancelPOCommand', () => {
  it('cancels a draft PO', async () => {
    const repo = mockRepo();
    const po = makePO();
    (repo.findById as jest.Mock).mockResolvedValue(po);

    const cmd = new CancelPOCommand(repo);
    await cmd.execute('po-1', { reason: 'Changed plans' });

    expect(repo.save).toHaveBeenCalledTimes(1);
    const savedOrder = (repo.save as jest.Mock).mock.calls[0][0];
    expect(savedOrder.status).toBe('cancelled');
  });

  it('cancels without reason', async () => {
    const repo = mockRepo();
    const po = makePO();
    (repo.findById as jest.Mock).mockResolvedValue(po);

    const cmd = new CancelPOCommand(repo);
    await cmd.execute('po-1');

    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
