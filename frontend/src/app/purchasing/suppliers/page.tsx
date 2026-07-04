'use client';
// =============================================================================
// SUPPLIER CRUD PAGE — List, create, edit suppliers
// =============================================================================

import { useState, useCallback, type Key } from 'react';
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
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
  DownOutlined,
  MoreOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';

import { supplierApi } from '@/lib/api/supplier';
import type { Supplier, CreateSupplierInput, UpdateSupplierInput } from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { CommandBar } from '@/components/d365/CommandBar';

export default function SuppliersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [createForm] = Form.useForm<CreateSupplierInput>();
  const [editForm] = Form.useForm<UpdateSupplierInput>();

  // D365 view-picker: the "view" is just the active-status filter presented as
  // named views (All / Active / Inactive), matching Power Apps' view selector.
  const VIEWS: { key: string; label: string; value: boolean | undefined }[] = [
    { key: 'all', label: 'All Suppliers', value: undefined },
    { key: 'active', label: 'Active Suppliers', value: true },
    { key: 'inactive', label: 'Inactive Suppliers', value: false },
  ];
  const currentView = VIEWS.find((v) => v.value === isActive) ?? VIEWS[0];

  const listQuery = useQuery({
    queryKey: ['suppliers', { page, limit, q, isActive }],
    queryFn: () => supplierApi.list({ page, limit, q: q || undefined, isActive }),
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
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <Typography.Link
          strong
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/purchasing/suppliers/${record.id}`);
          }}
        >
          {text}
        </Typography.Link>
      ),
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
      sorter: (a, b) => a.paymentTermDays - b.paymentTermDays,
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
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
              size="small"
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
              size="small"
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* D365 view-picker: selectable view name is the page header */}
      <div>
        <Dropdown
          trigger={['click']}
          menu={{
            selectable: true,
            selectedKeys: [currentView.key],
            items: VIEWS.map((v) => ({ key: v.key, label: v.label })),
            onClick: ({ key }) => {
              const next = VIEWS.find((v) => v.key === key);
              setIsActive(next?.value);
              setPage(1);
            },
          }}
        >
          <a
            role="button"
            tabIndex={0}
            onClick={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (e.currentTarget as HTMLElement).click();
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--surface-text)' }}
          >
            <Typography.Title level={4} style={{ margin: 0 }}>
              {currentView.label}
            </Typography.Title>
            <DownOutlined style={{ fontSize: 12, color: '#8A8886' }} />
          </a>
        </Dropdown>
      </div>

      {/* D365 command bar */}
      <CommandBar>
        <Button type="text" icon={<PlusOutlined />} onClick={() => setOpenCreate(true)}>
          New
        </Button>
        <Button
          type="text"
          icon={<ReloadOutlined />}
          loading={listQuery.isFetching}
          onClick={() => listQuery.refetch()}
        >
          Refresh
        </Button>
        <Button
          type="text"
          icon={<DeleteOutlined />}
          disabled={selectedRowKeys.length === 0}
        >
          Delete{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
        </Button>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'excel', icon: <FileExcelOutlined />, label: 'Export to Excel', disabled: true },
              { key: 'columns', icon: <TableOutlined />, label: 'Edit columns', disabled: true },
            ],
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label="More commands" />
        </Dropdown>

        <div style={{ flex: 1 }} />

        <Input.Search
          allowClear
          aria-label="Filter by keyword"
          placeholder="Filter by keyword"
          style={{ width: 240 }}
          onSearch={handleSearch}
        />
      </CommandBar>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<Supplier>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={data}
          loading={listQuery.isFetching}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onRow={(record) => ({
            onClick: () => router.push(`/purchasing/suppliers/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
            showTotal: (t) => `Rows: ${t}`,
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
