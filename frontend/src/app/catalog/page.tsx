'use client';

import { useState, type Key } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Card,
  Select,
  Tooltip,
  App,
  InputNumber,
  Dropdown
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DownOutlined,
  MoreOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  TableOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { catalogApi, type Product, type CreateProductInput, type UpdateProductInput } from '@/lib/api/catalog';
import { formatVnd } from '@/lib/format';
import { toMessage } from '@/lib/api/errors';
import { CommandBar } from '@/components/d365/CommandBar';

export default function CatalogPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  // D365 view-picker: the "view" is just the active-status filter presented as
  // named views (All / Active / Inactive), matching Power Apps' view selector.
  const VIEWS: { key: string; label: string; value: boolean | undefined }[] = [
    { key: 'all', label: 'All Products', value: undefined },
    { key: 'active', label: 'Active Products', value: true },
    { key: 'inactive', label: 'Inactive Products', value: false },
  ];
  const currentView =
    VIEWS.find((v) => v.value === isActive) ?? VIEWS[0];

  // Create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm();

  // Edit modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm] = Form.useForm();

  // Queries
  const listQuery = useQuery({
    queryKey: ['catalog', { q, page, limit, isActive }],
    queryFn: () => catalogApi.list({ q, page, limit, isActive }),
  });

  const editQuery = useQuery({
    queryKey: ['catalog', editingId],
    queryFn: () => catalogApi.get(editingId!),
    enabled: !!editingId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateProductInput) => catalogApi.create(data),
    onSuccess: () => {
      message.success('Product created');
      setOpenCreate(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProductInput) => catalogApi.update(editingId!, data),
    onSuccess: () => {
      message.success('Product updated');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => catalogApi.activate(id),
    onSuccess: () => {
      message.success('Product activated');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => catalogApi.deactivate(id),
    onSuccess: () => {
      message.success('Product deactivated');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleOpenEdit = (record: Product) => {
    setEditingId(record.id);
    editForm.setFieldsValue({
      sku: record.sku,
      name: record.name,
      unit: record.unit,
      defaultSalePrice: record.defaultSalePrice,
      taxRate: record.taxRate,
    });
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
      render: (v) => <Typography.Text keyboard>{v}</Typography.Text>,
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <Typography.Link
          strong
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/catalog/${record.id}`);
          }}
        >
          {text}
        </Typography.Link>
      ),
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
    },
    {
      title: 'Default Sale Price',
      dataIndex: 'defaultSalePrice',
      key: 'defaultSalePrice',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.defaultSalePrice - b.defaultSalePrice,
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Tax Rate',
      dataIndex: 'taxRate',
      key: 'taxRate',
      width: 100,
      align: 'center',
      render: (v: number) => `${((v ?? 0) * 100).toFixed(0)}%`,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 140,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Details">
            <Button type="text" icon={<EyeOutlined />} size="small" onClick={() => router.push(`/catalog/${record.id}`)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          {record.isActive ? (
            <Tooltip title="Inactive">
              <Button
                type="text"
                danger
                icon={<StopOutlined />}
                size="small"
                onClick={() => deactivateMutation.mutate(record.id)}
                loading={deactivateMutation.isPending && deactivateMutation.variables === record.id}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Activate">
              <Button
                type="text"
                style={{ color: '#52c41a' }}
                icon={<CheckCircleOutlined />}
                size="small"
                onClick={() => activateMutation.mutate(record.id)}
                loading={activateMutation.isPending && activateMutation.variables === record.id}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const renderFormFields = () => (
    <>
      <Form.Item
        name="sku"
        label="SKU"
        rules={[{ required: true, message: 'Please enter SKU' }]}
      >
        <Input placeholder="Enter SKU..." />
      </Form.Item>
      <Form.Item
        name="name"
        label="Product Name"
        rules={[{ required: true, message: 'Please enter product name' }]}
      >
        <Input placeholder="Enter product name..." />
      </Form.Item>
      <Form.Item
        name="unit"
        label="Unit"
        rules={[{ required: true, message: 'Please enter unit of measure' }]}
      >
        <Input placeholder="e.g. Piece, Box, Unit..." />
      </Form.Item>
      <Form.Item
        name="defaultSalePrice"
        label="Default Sale Price"
        rules={[{ required: true, message: 'Please enter sale price' }]}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => Number((value ?? '').replace(/,/g, '')) as 0}
          addonAfter="VNĐ"
        />
      </Form.Item>
      <Form.Item
        name="taxRate"
        label="Tax Rate"
        initialValue={0.10}
        rules={[{ required: true, message: 'Please select tax rate' }]}
      >
        <Select
          options={[
            { value: 0, label: '0%' },
            { value: 0.05, label: '5%' },
            { value: 0.08, label: '8%' },
            { value: 0.10, label: '10%' },
          ]}
        />
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
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
      </CommandBar>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<Product>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={listQuery.data?.data ?? []}
          loading={listQuery.isFetching}
          scroll={{ x: 1000 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onRow={(record) => ({
            onClick: () => router.push(`/catalog/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `Rows: ${total}`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      <Modal
        title="Add products"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutateAsync(values)}
        >
          {renderFormFields()}
        </Form>
      </Modal>

      <Modal
        title="Edit Product"
        open={!!editingId}
        onCancel={() => setEditingId(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateMutation.mutateAsync(values)}
        >
          {renderFormFields()}
        </Form>
      </Modal>
    </div>
  );
}
