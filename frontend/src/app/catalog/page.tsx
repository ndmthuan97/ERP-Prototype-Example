'use client';

import { useMemo, useState } from 'react';
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
  Row,
  Col,
  Select,
  Tooltip,
  App,
  InputNumber
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { catalogApi, type Product, type CreateProductInput, type UpdateProductInput } from '@/lib/api/catalog';
import { formatVnd } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { toMessage } from '@/lib/api/errors';

export default function CatalogPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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

  const statsQuery = useQuery({
    queryKey: ['catalog', 'stats-all'],
    queryFn: () => catalogApi.list({ page: 1, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  // Derived stat values
  const stats = useMemo(() => {
    const total = statsQuery.data?.total ?? listQuery.data?.total ?? 0;
    const products = statsQuery.data?.data ?? listQuery.data?.data ?? [];

    const activeCount = products.filter((p) => p.isActive).length;
    const inactiveCount = products.filter((p) => !p.isActive).length;

    const totalPrices = products.reduce((sum, p) => sum + p.defaultSalePrice, 0);
    const averagePrice = products.length > 0 ? totalPrices / products.length : 0;

    return {
      total: String(total),
      activeCount: String(activeCount),
      inactiveCount: String(inactiveCount),
      averagePrice: formatVnd(averagePrice)
    };
  }, [statsQuery.data, listQuery.data]);

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
      render: (v) => <Typography.Text keyboard>{v}</Typography.Text>,
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text) => <Typography.Text strong>{text}</Typography.Text>,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Product Catalog
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpenCreate(true)}
        >
          Add products
        </Button>
      </Space>

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<AppstoreOutlined />}
            iconBgColor="rgba(22, 119, 255, 0.1)"
            iconColor="#1677ff"
            label="Total Products"
            value={stats.total}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CheckCircleOutlined />}
            iconBgColor="rgba(82, 196, 26, 0.1)"
            iconColor="#52c41a"
            label="Active"
            value={stats.activeCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<StopOutlined />}
            iconBgColor="rgba(245, 34, 45, 0.1)"
            iconColor="#f5222d"
            label="Inactive"
            value={stats.inactiveCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<DollarOutlined />}
            iconBgColor="rgba(250, 173, 20, 0.1)"
            iconColor="#faad14"
            label="Avg Price"
            value={stats.averagePrice}
          />
        </Col>
      </Row>

      <Card
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="Search by SKU, name..."
            style={{ width: 320 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 180 }}
            onChange={(val) => {
              setIsActive(val);
              setPage(1);
            }}
            options={[
              { value: true, label: 'Active' },
              { value: false, label: 'Inactive' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => listQuery.refetch()}
          >
            Reload
          </Button>
        </Space>
      </Card>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Table<Product>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.data ?? []}
          loading={listQuery.isFetching}
          scroll={{ x: 1000 }}
          onRow={(record) => ({
            onClick: () => router.push(`/catalog/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `${total} products`,
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
