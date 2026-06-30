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
        label="Business Name"
        name="businessName"
        rules={[{ required: true, min: 2, message: 'At least 2 characters' }]}
      >
        <Input placeholder="e.g. ACME Corp" />
      </Form.Item>

      <Form.Item label="Tax Code" name="taxCode">
        <Input placeholder="e.g. 0312345678" />
      </Form.Item>

      <Form.Item label="Contact Person" name="contactName">
        <Input />
      </Form.Item>

      <Form.Item label="Phone" name="contactPhone">
        <Input />
      </Form.Item>

      <Form.Item
        label="Email"
        name="contactEmail"
        rules={[{ type: 'email', message: 'Invalid email' }]}
      >
        <Input />
      </Form.Item>

      {isAdmin && (
        <Form.Item
          label="Credit Limit (VND)"
          name="creditLimitAmount"
          tooltip="Admin/manager only"
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
