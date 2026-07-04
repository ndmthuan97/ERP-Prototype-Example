'use client';
// =============================================================================
// SUPPLIER DETAIL PAGE — Full supplier info + edit
// =============================================================================

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Card,
  Modal,
  Form,
  Input,
  InputNumber,
  App,
  Result,
  Tabs,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { supplierApi } from '@/lib/api/supplier';
import type { UpdateSupplierInput } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { FormSection, Field } from '@/components/d365/FormLayout';
import { CommandBar } from '@/components/d365/CommandBar';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SupplierDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [openEdit, setOpenEdit] = useState(false);
  const [editForm] = Form.useForm<UpdateSupplierInput>();

  const supplierQuery = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => supplierApi.get(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSupplierInput) => supplierApi.update(id, data),
    onSuccess: () => {
      message.success('Supplier updated');
      setOpenEdit(false);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  if (supplierQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="Loading supplier…" />
      </div>
    );
  }

  if (supplierQuery.isError) {
    const is404 =
      supplierQuery.error instanceof ApiError && supplierQuery.error.isNotFound;
    return (
      <Result
        status={is404 ? '404' : 'error'}
        title={is404 ? 'Supplier not found' : 'Failed to load supplier'}
        subTitle={is404 ? undefined : toMessage(supplierQuery.error)}
        extra={
          <Link href="/purchasing/suppliers">
            <Button type="primary">Back to Suppliers</Button>
          </Link>
        }
      />
    );
  }

  const supplier = supplierQuery.data!;

  const handleOpenEdit = () => {
    editForm.setFieldsValue({
      name: supplier.name,
      taxCode: supplier.taxCode ?? undefined,
      contactName: supplier.contactName ?? undefined,
      contactPhone: supplier.contactPhone ?? undefined,
      contactEmail: supplier.contactEmail ?? undefined,
      paymentTermDays: supplier.paymentTermDays,
    });
    setOpenEdit(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space align="center" size={12}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {supplier.name}
        </Typography.Title>
        <Tag color={supplier.isActive ? 'success' : 'default'}>
          {supplier.isActive ? 'Active' : 'Inactive'}
        </Tag>
      </Space>

      {/* D365 command bar */}
      <CommandBar>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push('/purchasing/suppliers')}>
          Back
        </Button>
        <Button type="text" icon={<EditOutlined />} onClick={handleOpenEdit}>
          Edit
        </Button>
      </CommandBar>

      {/* D365-style tabbed form: General tab with sectioned, 2-column fields */}
      <Card style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}>
        <Tabs
          defaultActiveKey="general"
          items={[
            {
              key: 'general',
              label: 'General',
              children: (
                <Space direction="vertical" size={28} style={{ width: '100%' }}>
                  <FormSection title="Supplier details">
                    <Field label="Supplier Name">{supplier.name}</Field>
                    <Field label="Tax Code">{supplier.taxCode ?? '—'}</Field>
                    <Field label="Contact Person">{supplier.contactName ?? '—'}</Field>
                    <Field label="Phone">{supplier.contactPhone ?? '—'}</Field>
                    <Field label="Email">{supplier.contactEmail ?? '—'}</Field>
                    <Field label="Payment Terms">{`${supplier.paymentTermDays} days`}</Field>
                    <Field label="Status">
                      <Tag color={supplier.isActive ? 'success' : 'default'}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Tag>
                    </Field>
                  </FormSection>

                  <FormSection title="System information">
                    <Field label="Created">{formatDateTime(supplier.createdAt)}</Field>
                    <Field label="Last Updated">{formatDateTime(supplier.updatedAt)}</Field>
                  </FormSection>
                </Space>
              ),
            },
            { key: 'related', label: 'Related', disabled: true },
          ]}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Edit Supplier"
        open={openEdit}
        onCancel={() => setOpenEdit(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateMutation.mutate(values)}
        >
          <Form.Item name="name" label="Supplier Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="taxCode" label="Tax Code">
            <Input />
          </Form.Item>
          <Form.Item name="contactName" label="Contact Person">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="contactEmail" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="paymentTermDays" label="Payment Terms (days)">
            <InputNumber<number> style={{ width: '100%' }} min={0} max={365} precision={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
