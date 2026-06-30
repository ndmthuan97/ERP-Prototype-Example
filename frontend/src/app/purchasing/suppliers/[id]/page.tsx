'use client';
// =============================================================================
// SUPPLIER DETAIL PAGE — Full supplier info + edit
// =============================================================================

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Card,
  Breadcrumb,
  Modal,
  Form,
  Input,
  InputNumber,
  App,
  Result,
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
      <Breadcrumb
        items={[
          { title: <Link href="/">Home</Link> },
          { title: <Link href="/purchasing">Purchasing</Link> },
          { title: <Link href="/purchasing/suppliers">Suppliers</Link> },
          { title: supplier.name },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/purchasing/suppliers')} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            {supplier.name}
          </Typography.Title>
          <Tag color={supplier.isActive ? 'success' : 'default'}>
            {supplier.isActive ? 'Active' : 'Inactive'}
          </Tag>
        </Space>
        <Button type="primary" icon={<EditOutlined />} onClick={handleOpenEdit}>
          Edit
        </Button>
      </div>

      <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Supplier Name">
            <Typography.Text strong>{supplier.name}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tax Code">
            {supplier.taxCode ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Contact Person">
            {supplier.contactName ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Phone">
            {supplier.contactPhone ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {supplier.contactEmail ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Payment Terms">
            {supplier.paymentTermDays} days
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={supplier.isActive ? 'success' : 'default'}>
              {supplier.isActive ? 'Active' : 'Inactive'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {formatDateTime(supplier.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {formatDateTime(supplier.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
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
