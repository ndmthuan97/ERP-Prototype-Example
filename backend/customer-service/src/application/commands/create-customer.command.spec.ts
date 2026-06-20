// =============================================================================
// UNIT TEST — CreateCustomerCommand (Application layer)
// =============================================================================
// Test use case với repository + cache được MOCK (không chạm DB/Redis thật).
// Đây là lợi ích của Dependency Inversion: command phụ thuộc interface →
// test inject mock dễ dàng, chạy nhanh, deterministic.

import { ConflictException } from '@nestjs/common';
import { CreateCustomerCommand } from './create-customer.command';
import { Customer } from '../../domain/entities/customer.entity';
import type { ICustomerRepository } from '../../domain/repositories/customer.repository';

/** Tạo mock repository — chỉ cần các method command dùng tới */
function makeRepoMock(): jest.Mocked<ICustomerRepository> {
  return {
    findById: jest.fn(),
    findByTaxCode: jest.fn(),
    search: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('CreateCustomerCommand', () => {
  it('tạo khách hàng thành công, gọi save', async () => {
    const repo = makeRepoMock();

    // Không trùng MST + save trả lại chính entity được truyền vào
    repo.findByTaxCode.mockResolvedValue(null);
    repo.save.mockImplementation(async (customer: Customer) => customer);

    const command = new CreateCustomerCommand(repo);

    const result = await command.execute({
      businessName: 'WeCare Corp',
      taxCode: '0312345678',
    });

    expect(result).toBeInstanceOf(Customer);
    expect(result.businessName).toBe('WeCare Corp');
    expect(result.status).toBe('active');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('ném ConflictException khi mã số thuế đã tồn tại — không save', async () => {
    const repo = makeRepoMock();

    // Giả lập đã có khách hàng dùng MST này
    repo.findByTaxCode.mockResolvedValue({
      businessName: 'Đối thủ',
    } as Customer);

    const command = new CreateCustomerCommand(repo);

    await expect(
      command.execute({ businessName: 'WeCare Corp', taxCode: '0312345678' }),
    ).rejects.toBeInstanceOf(ConflictException);

    // Trùng MST → dừng sớm, KHÔNG được lưu
    expect(repo.save).not.toHaveBeenCalled();
  });
});
