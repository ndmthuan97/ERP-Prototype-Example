'use client';
// =============================================================================
// PHASE 2 — TỒN KHO: list + search + phân trang + tạo item + nhập kho + kiểm tra tồn
// =============================================================================

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Input,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  InputNumber,
  App,
  Badge,
  Statistic,
  Row,
  Col,
  Card,
  Tooltip,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ImportOutlined,
  SearchOutlined,
  EyeOutlined,
  AppstoreOutlined,
  DollarOutlined,
  WarningOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { inventoryApi } from '@/lib/api/inventory';
import type { StockItem, CreateItemInput, Availability } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { StatCard } from '@/components/StatCard';

export default function InventoryPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  // List state
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Modal states
  const [openCreate, setOpenCreate] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<StockItem | null>(null);
  const [availTarget, setAvailTarget] = useState<StockItem | null>(null);
  const [availResult, setAvailResult] = useState<Availability | null>(null);

  // Forms
  const [createForm] = Form.useForm<CreateItemInput>();
  const [receiveForm] = Form.useForm<{ quantity: number }>();
  const [availForm] = Form.useForm<{ quantity: number }>();

  // ---------------------------------------------------------------------------
  // Queries & Mutations
  // ---------------------------------------------------------------------------
  const listQuery = useQuery({
    queryKey: ['inventory', { q, page, limit }],
    queryFn: () => inventoryApi.list({ q, page, limit }),
  });

  // ---------------------------------------------------------------------------
  // Derived stat values from paginated data
  // Low stock / out of stock are approximate (current page only) unless total < limit
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const items = listQuery.data?.data ?? [];
    const totalProducts = listQuery.data?.total ?? 0;
    const totalStock = items.reduce((sum, i) => sum + i.quantityAvailable, 0);
    const lowStockCount = items.filter(
      (i) => i.quantityAvailable > 0 && i.quantityAvailable <= 20,
    ).length;
    const outOfStockCount = items.filter(
      (i) => i.quantityAvailable === 0,
    ).length;

    return { totalProducts, totalStock, lowStockCount, outOfStockCount };
  }, [listQuery.data]);

  const createMutation = useMutation({
    mutationFn: (input: CreateItemInput) => inventoryApi.create(input),
    onSuccess: () => {
      message.success('Product created');
      setOpenCreate(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors();
        const entries = Object.entries(fields);
        if (entries.length) {
          createForm.setFields(
            entries.map(([name, msg]) => ({ name: name as keyof CreateItemInput, errors: [msg] })),
          );
        }
        // 409 = duplicate SKU
        if (err.isConflict) {
          createForm.setFields([{ name: 'sku' as const, errors: [err.message] }]);
        }
      }
      message.error(toMessage(err));
    },
  });

  const receiveMutation = useMutation({
    mutationFn: ({ sku, quantity }: { sku: string; quantity: number }) =>
      inventoryApi.receive(sku, quantity),
    onSuccess: (_, vars) => {
      message.success(`Stock imported ${vars.quantity} units cho ${vars.sku}`);
      setReceiveTarget(null);
      receiveForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const [availLoading, setAvailLoading] = useState(false);

  const handleCheckAvailability = async (values: { quantity: number }) => {
    if (!availTarget) return;
    setAvailLoading(true);
    try {
      const result = await inventoryApi.availability(availTarget.sku, values.quantity);
      setAvailResult(result);
    } catch (err) {
      message.error(toMessage(err));
    } finally {
      setAvailLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const getQuantityColor = (v: number): string => {
    if (v < 10) return '#ff4d4f';
    if (v <= 50) return '#faad14';
    return '#52c41a';
  };

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------
  const columns: ColumnsType<StockItem> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku: string) => (
        <a
          onClick={() => router.push(`/inventory/${encodeURIComponent(sku)}`)}
          style={{ fontFamily: 'monospace', fontSize: 12, color: '#8c8c8c' }}
        >
          {sku}
        </a>
      ),
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Qty Available',
      dataIndex: 'quantityAvailable',
      key: 'quantityAvailable',
      align: 'right',
      render: (v: number) => (
        <Space size={4}>
          <span style={{ color: getQuantityColor(v), fontWeight: 600 }}>
            {v.toLocaleString('vi-VN')}
          </span>
          {v === 0 && <Tag color="error" style={{ margin: 0, fontSize: 11 }}>Out of Stock</Tag>}
          {v > 0 && v <= 20 && <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>Low Stock</Tag>}
        </Space>
      ),
    },
    {
      title: 'SL reserved',
      dataIndex: 'quantityReserved',
      key: 'quantityReserved',
      align: 'right',
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Action',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/inventory/${encodeURIComponent(record.sku)}`)}
            />
          </Tooltip>
          <Tooltip title="Import Stock">
            <Button
              type="text"
              size="small"
              icon={<ImportOutlined />}
              onClick={() => setReceiveTarget(record)}
            />
          </Tooltip>
          <Tooltip title="Check Availability">
            <Button
              type="text"
              size="small"
              icon={<SearchOutlined />}
              onClick={() => {
                setAvailTarget(record);
                setAvailResult(null);
                availForm.resetFields();
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Inventory
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpenCreate(true)}
        >
          Create Product
        </Button>
      </div>

      {/* Stats Row */}
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<AppstoreOutlined />}
            iconBgColor="rgba(22,119,255,0.1)"
            iconColor="#1677ff"
            label="Total Products"
            value={listQuery.data ? String(stats.totalProducts) : '—'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<DollarOutlined />}
            iconBgColor="rgba(82,196,26,0.1)"
            iconColor="#52c41a"
            label="Total Stock"
            value={listQuery.data ? stats.totalStock.toLocaleString('vi-VN') : '—'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<WarningOutlined />}
            iconBgColor="rgba(250,173,20,0.1)"
            iconColor="#faad14"
            label="Low Stock Items"
            value={listQuery.data ? String(stats.lowStockCount) : '—'}
            trend={{
              text: stats.lowStockCount > 0
                ? `${stats.lowStockCount} products items need restocking`
                : 'All stocked',
              color: stats.lowStockCount > 0 ? 'orange' : 'green',
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<StopOutlined />}
            iconBgColor="rgba(255,77,79,0.1)"
            iconColor="#ff4d4f"
            label="Out of Stock"
            value={listQuery.data ? String(stats.outOfStockCount) : '—'}
            trend={{
              text: stats.outOfStockCount > 0
                ? 'Needs restocking'
                : 'All in stock',
              color: stats.outOfStockCount > 0 ? 'red' : 'green',
            }}
          />
        </Col>
      </Row>

      {/* Filter */}
      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Space>
          <Input.Search
            allowClear
            placeholder="Search by SKU or name…"
            style={{ width: 320 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()}>
            Reload
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Table<StockItem>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.data ?? []}
          loading={listQuery.isFetching}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onDoubleClick: () =>
              router.push(`/inventory/${encodeURIComponent(record.sku)}`),
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

      {/* ---- Create Item Modal ---- */}
      <Modal
        title="Create Product"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form<CreateItemInput>
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            label="SKU"
            name="sku"
            rules={[
              { required: true, message: 'Please enter SKU' },
              { min: 2, max: 64, message: 'SKU must be 2–64 characters' },
            ]}
          >
            <Input placeholder="VD: SP-001" />
          </Form.Item>
          <Form.Item
            label="Product Name"
            name="name"
            rules={[
              { required: true, message: 'Please enter name' },
              { min: 2, message: 'At least 2 characters' },
            ]}
          >
            <Input placeholder="Products ABC" />
          </Form.Item>
          <Form.Item
            label="Initial Quantity"
            name="initialQuantity"
            initialValue={0}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              precision={0}
              placeholder="0"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Receive Stock Modal ---- */}
      <Modal
        title={`Import Stock — ${receiveTarget?.sku ?? ''}`}
        open={!!receiveTarget}
        onCancel={() => {
          setReceiveTarget(null);
          receiveForm.resetFields();
        }}
        onOk={() => receiveForm.submit()}
        confirmLoading={receiveMutation.isPending}
        okText="Import Stock"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form<{ quantity: number }>
          form={receiveForm}
          layout="vertical"
          onFinish={(values) =>
            receiveTarget &&
            receiveMutation.mutate({ sku: receiveTarget.sku, quantity: values.quantity })
          }
        >
          <Form.Item
            label="Import Quantity"
            name="quantity"
            rules={[
              { required: true, message: 'Please enter quantity' },
              { type: 'number', min: 1, message: 'Quantity must be ≥ 1' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="Enter quantity"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Availability Check Modal ---- */}
      <Modal
        title={`Check Availability — ${availTarget?.sku ?? ''}`}
        open={!!availTarget}
        onCancel={() => {
          setAvailTarget(null);
          setAvailResult(null);
          availForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<{ quantity: number }>
          form={availForm}
          layout="vertical"
          onFinish={handleCheckAvailability}
        >
          <Form.Item
            label="Quantity to Check"
            name="quantity"
            rules={[
              { required: true, message: 'Please enter quantity' },
              { type: 'number', min: 1, message: 'Quantity must be ≥ 1' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="Enter quantity"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={availLoading}>
              Check
            </Button>
          </Form.Item>
        </Form>

        {availResult && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Statistic title="Available" value={availResult.available} />
            </Col>
            <Col span={6}>
              <Statistic title="Reserved" value={availResult.reserved} />
            </Col>
            <Col span={6}>
              <Statistic title="Total" value={availResult.total} />
            </Col>
            <Col span={6}>
              <Statistic
                title="Can Reserve"
                valueRender={() => (
                  <Badge
                    status={availResult.canReserve ? 'success' : 'error'}
                    text={availResult.canReserve ? 'Yes' : 'No'}
                  />
                )}
              />
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
}
