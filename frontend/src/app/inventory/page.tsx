'use client';
// =============================================================================
// PHASE 2 — TỒN KHO: list + search + phân trang + tạo item + nhập kho + kiểm tra tồn
// =============================================================================

import { useState, useMemo, type Key } from 'react';
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
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ImportOutlined,
  SearchOutlined,
  EyeOutlined,
  DownOutlined,
  MoreOutlined,
  FileExcelOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { inventoryApi } from '@/lib/api/inventory';
import type { StockItem, CreateItemInput, Availability } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { CommandBar } from '@/components/d365/CommandBar';

export default function InventoryPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  // List state
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  // D365 view-picker: inventory has no server status filter, so the "view" is a
  // client-side stock-status lens (All / Low stock / Out of stock) over the page.
  const VIEWS: { key: string; label: string; test: (i: StockItem) => boolean }[] = [
    { key: 'all', label: 'All Items', test: () => true },
    { key: 'low', label: 'Low Stock', test: (i) => i.quantityAvailable > 0 && i.quantityAvailable <= 20 },
    { key: 'out', label: 'Out of Stock', test: (i) => i.quantityAvailable === 0 },
  ];
  const [view, setView] = useState('all');
  const currentView = VIEWS.find((v) => v.key === view) ?? VIEWS[0];

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

  // Client-side view filter applied to the current page of results.
  const rows = useMemo(() => {
    const items = listQuery.data?.data ?? [];
    return items.filter(currentView.test);
  }, [listQuery.data, currentView]);

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
      width: 160,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
      render: (v: string) => <Typography.Text keyboard>{v}</Typography.Text>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 260,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text: string, record) => (
        <Typography.Link
          strong
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/inventory/${encodeURIComponent(record.sku)}`);
          }}
        >
          {text}
        </Typography.Link>
      ),
    },
    {
      title: 'Qty Available',
      dataIndex: 'quantityAvailable',
      key: 'quantityAvailable',
      width: 180,
      align: 'right',
      sorter: (a, b) => a.quantityAvailable - b.quantityAvailable,
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
      width: 130,
      align: 'right',
      sorter: (a, b) => a.quantityReserved - b.quantityReserved,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Action',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
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
              setView(key);
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

      {/* Table */}
      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<StockItem>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isFetching}
          scroll={{ x: 900 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onDoubleClick: () =>
              router.push(`/inventory/${encodeURIComponent(record.sku)}`),
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total: currentView.key === 'all' ? (listQuery.data?.total ?? 0) : rows.length,
            showSizeChanger: true,
            showTotal: (total) => `Rows: ${total}`,
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
