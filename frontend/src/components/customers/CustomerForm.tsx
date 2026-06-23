'use client';
// Shared form for Create + Edit customer. Maps API validation errors to fields.

import { Form, Input, InputNumber } from 'antd';
import type { FormInstance } from 'antd';
import type { CreateCustomerInput } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';

export interface CustomerFormProps {
  initialValues?: Partial<CreateCustomerInput>;
  onSubmit: (values: CreateCustomerInput) => Promise<unknown>;
  loading?: boolean;
  form: FormInstance<CreateCustomerInput>;
}

export function CustomerForm({
  initialValues,
  onSubmit,
  loading,
  form,
}: CustomerFormProps) {
  const { isAdmin } = useAuth();

  return (
    <Form<CreateCustomerInput>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onSubmit}
      disabled={loading}
    >
      <Form.Item
        label="Tên doanh nghiệp"
        name="businessName"
        rules={[{ required: true, min: 2, message: 'Tối thiểu 2 ký tự' }]}
      >
        <Input placeholder="Công ty TNHH ABC" />
      </Form.Item>

      <Form.Item label="Mã số thuế" name="taxCode">
        <Input placeholder="0312345678 hoặc 0312345678-001" />
      </Form.Item>

      <Form.Item label="Người liên hệ" name="contactName">
        <Input />
      </Form.Item>

      <Form.Item label="Điện thoại" name="contactPhone">
        <Input />
      </Form.Item>

      <Form.Item
        label="Email"
        name="contactEmail"
        rules={[{ type: 'email', message: 'Email không hợp lệ' }]}
      >
        <Input />
      </Form.Item>

      {isAdmin && (
        <Form.Item
          label="Hạn mức tín dụng (VND)"
          name="creditLimitAmount"
          tooltip="Chỉ admin/manager được đặt (xem fix bảo mật C6)"
        >
          <InputNumber<number>
            style={{ width: '100%' }}
            min={0}
            step={1_000_000}
            formatter={(v) =>
              `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            }
            parser={(v) => Number((v ?? '').replace(/,/g, '')) as number}
          />
        </Form.Item>
      )}
    </Form>
  );
}
