'use client';
// =============================================================================
// SUPPLIER CRUD PAGE — List, create, edit suppliers
// =============================================================================

import { useState, useCallback } from 'react';
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
      message.success('Đã tạo nhà cung cấp');
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
      message.success('Đã cập nhật nhà cung cấp');
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
      title: 'Tên NCC',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Mã số thuế',
      dataIndex: 'taxCode',
      key: 'taxCode',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Liên hệ',
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
      title: 'Thanh toán',
      dataIndex: 'paymentTermDays',
      key: 'paymentTermDays',
      align: 'center',
      render: (v: number) => `${v} ngày`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>
          {active ? 'Hoạt động' : 'Ngừng'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, record) => (
        <Tooltip title="Chỉnh sửa">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(record);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  const supplierFormFields = (
    <>
      <Form.Item
        label="Tên nhà cung cấp"
        name="name"
        rules={[{ required: true, message: 'Nhập tên NCC' }]}
      >
        <Input placeholder="VD: Công ty TNHH ABC" />
      </Form.Item>
      <Form.Item label="Mã số thuế" name="taxCode">
        <Input placeholder="VD: 0123456789" />
      </Form.Item>
      <Form.Item label="Người liên hệ" name="contactName">
        <Input placeholder="VD: Nguyễn Văn A" />
      </Form.Item>
      <Form.Item label="Số điện thoại" name="contactPhone">
        <Input placeholder="VD: 0901234567" />
      </Form.Item>
      <Form.Item label="Email" name="contactEmail">
        <Input placeholder="VD: supplier@example.com" />
      </Form.Item>
      <Form.Item label="Kỳ thanh toán (ngày)" name="paymentTermDays">
        <InputNumber<number> style={{ width: '100%' }} min={0} max={365} precision={0} placeholder="VD: 30" />
      </Form.Item>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Quản lý nhà cung cấp
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenCreate(true)}>
          Thêm NCC
        </Button>
      </Space>

      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Space wrap>
          <Input.Search
            placeholder="Tìm nhà cung cấp..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()}>
            Tải lại
          </Button>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
        <Table<Supplier>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={listQuery.isFetching}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} nhà cung cấp`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Thêm nhà cung cấp"
        open={openCreate}
        onCancel={() => { setOpenCreate(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Tạo"
        cancelText="Hủy"
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
        title="Chỉnh sửa nhà cung cấp"
        open={!!editingSupplier}
        onCancel={() => { setEditingSupplier(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Lưu"
        cancelText="Hủy"
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
