// =============================================================================
// DELIVERY ORDER ENTITY — Tracks shipment of goods for a confirmed Sales Order
// =============================================================================
// State machine: draft → picking → packed → shipped → delivered
//                shipped → failed (with reason)
//
// A SalesOrder can have multiple DeliveryOrders (partial delivery).
// Each DeliveryOrder contains lines referencing the original SO lines.

import { DeliveryLine } from './delivery-line.entity.js';
import { InvalidStatusTransitionError } from './sales-order.entity.js';

export type DeliveryStatus =
  | 'draft'
  | 'picking'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'failed';

export interface DeliveryOrderProps {
  id: string;
  salesOrderId: string;
  status: DeliveryStatus;
  failReason: string | null;
  version: number;
  lines: DeliveryLine[];
  createdAt: Date;
  updatedAt: Date;
}

export class DeliveryOrder {
  readonly id: string;
  readonly salesOrderId: string;
  status: DeliveryStatus;
  failReason: string | null;
  readonly version: number;
  private _lines: DeliveryLine[];
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: DeliveryOrderProps) {
    this.id = props.id;
    this.salesOrderId = props.salesOrderId;
    this.status = props.status;
    this.failReason = props.failReason;
    this.version = props.version;
    this._lines = [...props.lines];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get lines(): readonly DeliveryLine[] {
    return this._lines;
  }

  /** Add a line: draft only */
  addLine(line: DeliveryLine): void {
    if (this.status !== 'draft') {
      throw new InvalidStatusTransitionError(this.status, 'addLine');
    }
    this._lines.push(line);
    this.touch();
  }

  /** Start picking: draft → picking */
  startPicking(): void {
    if (this.status !== 'draft') {
      throw new InvalidStatusTransitionError(this.status, 'startPicking');
    }
    if (this._lines.length === 0) {
      throw new Error('Cannot start picking with no lines');
    }
    this.status = 'picking';
    this.touch();
  }

  /** Pack: picking → packed */
  pack(): void {
    if (this.status !== 'picking') {
      throw new InvalidStatusTransitionError(this.status, 'pack');
    }
    this.status = 'packed';
    this.touch();
  }

  /** Ship: packed → shipped */
  ship(): void {
    if (this.status !== 'packed') {
      throw new InvalidStatusTransitionError(this.status, 'ship');
    }
    this.status = 'shipped';
    this.touch();
  }

  /** Confirm delivery: shipped → delivered (raises domain event) */
  confirmDelivery(): void {
    if (this.status !== 'shipped') {
      throw new InvalidStatusTransitionError(this.status, 'confirmDelivery');
    }
    this.status = 'delivered';
    this.touch();
  }

  /** Mark as failed: shipped → failed */
  markFailed(reason: string): void {
    if (this.status !== 'shipped') {
      throw new InvalidStatusTransitionError(this.status, 'markFailed');
    }
    this.status = 'failed';
    this.failReason = reason;
    this.touch();
  }

  toJSON() {
    return {
      id: this.id,
      salesOrderId: this.salesOrderId,
      status: this.status,
      failReason: this.failReason,
      version: this.version,
      lines: this._lines,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  static createFromOrder(id: string, salesOrderId: string): DeliveryOrder {
    const now = new Date();
    return new DeliveryOrder({
      id,
      salesOrderId,
      status: 'draft',
      failReason: null,
      version: 0,
      lines: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}
