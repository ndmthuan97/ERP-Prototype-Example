// =============================================================================
// DELIVERY ORDER REPOSITORY — Port (DDD/Hexagonal)
// =============================================================================
import { DeliveryOrder } from '../entities/delivery-order.entity.js';

export const DELIVERY_ORDER_REPOSITORY = 'DELIVERY_ORDER_REPOSITORY';

export interface IDeliveryOrderRepository {
  findById(id: string): Promise<DeliveryOrder | null>;
  findBySalesOrderId(salesOrderId: string): Promise<DeliveryOrder[]>;

  /** Create a new delivery order with its lines */
  create(delivery: DeliveryOrder): Promise<DeliveryOrder>;

  /** Update delivery order status */
  update(delivery: DeliveryOrder): Promise<DeliveryOrder>;
}
