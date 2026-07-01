// Barrel export cho application DTOs
export {
  createCustomerSchema,
  validateCreateCustomer,
  CreateCustomerBodyDto,
} from './create-customer.dto.js';
export type { CreateCustomerDto } from './create-customer.dto.js';

export {
  updateCustomerSchema,
  updateCustomerBodySchema,
  validateUpdateCustomer,
  UpdateCustomerBodyDto,
} from './update-customer.dto.js';
export type { UpdateCustomerDto } from './update-customer.dto.js';
