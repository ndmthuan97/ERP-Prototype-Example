'use client';
// =============================================================================
// SUPPLIER CRUD PAGE — List, create, edit suppliers
// =============================================================================

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Card,
  Input,
  Modal,
  Form,
  InputNumber,
  App,
  Tooltip,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import { supplierApi } from '@/lib/api/supplier';
import type { Supplier, CreateSupplierInput, UpdateSupplierInput } from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';

export default function SuppliersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [createForm] = Form.useForm<CreateSupplierInput>();
  const [editForm] = Form.useForm<UpdateSupplierInput>();

  const listQuery = useQuery({
    queryKey: ['suppliers', { page, limit, q }],
    queryFn: () => supplierApi.list({ page, limit, q: q || undefined }),
  });

  const data = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (input: CreateSupplierInput) => supplierApi.create(input),
    onSuccess: () => {
      message.success('Supplier created');
      setOpenCreate(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierInput }) =>
      supplierApi.update(id, data),
    onSuccess: () => {
      message.success('Supplier updated');
      setEditingSupplier(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    editForm.setFieldsValue({
      name: supplier.name,
      taxCode: supplier.taxCode ?? undefined,
      contactName: supplier.contactName ?? undefined,
      contactPhone: supplier.contactPhone ?? undefined,
      contactEmail: supplier.contactEmail ?? undefined,
      paymentTermDays: supplier.paymentTermDays,
    });
  };

  const columns: ColumnsType<Supplier> = [
    {
      title: 'Supplier Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Tax Code',
      dataIndex: 'taxCode',
      key: 'taxCode',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          {record.contactName && <Typography.Text>{record.contactName}</Typography.Text>}
          {record.contactPhone && (
            <Typography.Text type="secondary">{record.contactPhone}</Typography.Text>
          )}
          {record.contactEmail && (
            <Typography.Text type="secondary">{record.contactEmail}</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Payment',
      dataIndex: 'paymentTermDays',
      key: 'paymentTermDays',
      align: 'center',
      render: (v: number) => `${v} days`,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/purchasing/suppliers/${record.id}`);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(record);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const supplierFormFields = (
    <>
      <Form.Item
        label="Supplier Name"
        name="name"
        rules={[{ required: true, message: 'Enter supplier name' }]}
      >
        <Input placeholder="VD: e.g. ACME Corp" />
      </Form.Item>
      <Form.Item label="Tax Code" name="taxCode">
        <Input placeholder="VD: 0123456789" />
      </Form.Item>
      <Form.Item label="Contact Person" name="contactName">
        <Input placeholder="e.g. John Doe" />
      </Form.Item>
      <Form.Item label="Phone" name="contactPhone">
        <Input placeholder="VD: 0901234567" />
      </Form.Item>
      <Form.Item label="Email" name="contactEmail">
        <Input placeholder="VD: supplier@example.com" />
      </Form.Item>
      <Form.Item label="Payment Terms (days)" name="paymentTermDays">
        <InputNumber<number> style={{ width: '100%' }} min={0} max={365} precision={0} placeholder="VD: 30" />
      </Form.Item>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Supplier Management
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenCreate(true)}>
          Add Supplier
        </Button>
      </Space>

      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Space wrap>
          <Input.Search
            placeholder="Search suppliers..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()}>
            Reload
          </Button>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
        <Table<Supplier>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={listQuery.isFetching}
          onRow={(record) => ({
            onClick: () => router.push(`/purchasing/suppliers/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} suppliers`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Add suppliers"
        open={openCreate}
        onCancel={() => { setOpenCreate(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          {supplierFormFields}
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit suppliers"
        open={!!editingSupplier}
        onCancel={() => { setEditingSupplier(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save"
        cancelText="Cancel"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingSupplier) {
              updateMutation.mutate({ id: editingSupplier.id, data: values });
            }
          }}
        >
          {supplierFormFields}
        </Form>
      </Modal>
    </div>
  );
}
