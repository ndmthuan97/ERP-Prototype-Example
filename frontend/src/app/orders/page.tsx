'use client';
// =============================================================================
// PHASE 3 — ĐƠN HÀNG: list + filter trạng thái + phân trang + tạo draft
// =============================================================================
// Pagination uses PaginatedMeta<T> (nested meta) — different from Customer/Inventory.
// Create draft: pick customer via async search → createDraft → navigate to detail.
// Submit/Cancel actions are on the order detail page.

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Select,
  App,
  Alert,
  Card,
  Row,
  Col,
  Input,
  Tooltip,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ClockCircleOutlined,
  SendOutlined,
  DollarOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { salesApi } from '@/lib/api/sales';
import { customerApi } from '@/lib/api/customer';
import type {
  SalesOrderSummary,
  OrderStatus,
  CreateOrderInput,
} from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { ORDER_STATUS, statusLabel } from '@/lib/constants/status';

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  confirmed: 'success',
  partially_delivered: 'warning',
  fully_delivered: 'cyan',
  cancelled: 'error',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'partially_delivered', label: 'Partially Delivered' },
  { value: 'fully_delivered', label: 'Fully Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [openCreate, setOpenCreate] = useState(false);
  const [form] = Form.useForm<CreateOrderInput>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Async customer search state
  const [customerSearch, setCustomerSearch] = useState('');

  // ---- Queries ----

  const listQuery = useQuery({
    queryKey: ['orders', { status, page, limit, dateRange }],
    queryFn: () =>
      salesApi.list({
        page,
        limit,
        status: status || undefined,
        createdFrom: dateRange?.[0],
        createdTo: dateRange?.[1],
      }),
  });

  const customerSearchQuery = useQuery({
    queryKey: ['customers', 'search', customerSearch],
    queryFn: () => customerApi.list({ q: customerSearch, page: 1, limit: 20 }),
    enabled: openCreate,
  });

  // ---- Derived stats from current page data ----

  const ordersData = listQuery.data?.data ?? [];

  const pendingCount = useMemo(
    () => ordersData.filter((o) => o.status === 'draft' || o.status === 'submitted').length,
    [ordersData],
  );

  const shippingCount = useMemo(
    () => ordersData.filter((o) => o.status === 'confirmed').length,
    [ordersData],
  );

  const totalRevenue = useMemo(
    () => ordersData.reduce((sum, o) => sum + o.totalAmount, 0),
    [ordersData],
  );

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (input: CreateOrderInput) => salesApi.createDraft(input),
    onSuccess: (order) => {
      message.success('Order created draft');
      setOpenCreate(false);
      form.resetFields();
      setCustomerSearch('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.push(`/orders/${order.id}`);
    },
    onError: (err) => {
      message.error(toMessage(err));
    },
  });

  // ---- Handlers ----

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);

  // ---- Table columns ----

  const columns: ColumnsType<SalesOrderSummary> = [
    {
      title: 'Order ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Typography.Link
          onClick={() => router.push(`/orders/${id}`)}
          style={{ color: '#1677ff', fontWeight: 500 }}
        >
          {id.slice(0, 8)}…
        </Typography.Link>
      ),
    },
    {
      title: 'Customers',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (id: string) => (
        <Typography.Text copyable={{ text: id }}>
          {id.slice(0, 8)}…
        </Typography.Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: OrderStatus) => (
        <Tag color={ORDER_STATUS.color[s]}>{statusLabel(ORDER_STATUS.label, s)}</Tag>
      ),
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Lines',
      dataIndex: 'lineCount',
      key: 'lineCount',
      align: 'center',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/orders/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ---- Pagination (PaginatedMeta format) ----

  const meta = listQuery.data?.meta;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Orders
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpenCreate(true)}
        >
          Create Order
        </Button>
      </Space>

      {/* Stats row */}
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ShoppingCartOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(22,119,255,0.1)"
            iconColor="#1677ff"
            label="Total Items"
            value={meta?.total ?? '—'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ClockCircleOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(250,173,20,0.1)"
            iconColor="#faad14"
            label="Pending"
            value={String(pendingCount)}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<SendOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(19,194,194,0.1)"
            iconColor="#13c2c2"
            label="In Transit"
            value={String(shippingCount)}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<DollarOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(82,196,26,0.1)"
            iconColor="#52c41a"
            label="Revenue (current page)"
            value={formatVnd(totalRevenue)}
          />
        </Col>
      </Row>

      {/* Filter section */}
      <Card
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Space wrap>
          <Input.Search
            placeholder="Search orders…"
            allowClear
            style={{ width: 260 }}
          />
          <Select
            value={status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            style={{ width: 180 }}
            placeholder="Filter by status"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => listQuery.refetch()}
          >
            Reload
          </Button>
          <DatePicker.RangePicker
            style={{ width: 260 }}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([
                  dates[0].toISOString(),
                  dates[1].toISOString(),
                ]);
              } else {
                setDateRange(null);
              }
              setPage(1);
            }}
            placeholder={['From date', 'To date']}
          />
        </Space>
      </Card>

      {listQuery.isError && (
        <Alert
          type="error"
          showIcon
          message="Failed to load orders"
          description={toMessage(listQuery.error)}
        />
      )}

      <Table<SalesOrderSummary>
        rowKey="id"
        columns={columns}
        dataSource={listQuery.data?.data ?? []}
        loading={listQuery.isFetching}
        onRow={(record) => ({
          onClick: () => router.push(`/orders/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: meta?.page ?? page,
          pageSize: meta?.limit ?? limit,
          total: meta?.total ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `${total} orders`,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setLimit(nextSize);
          },
        }}
      />

      {/* ---- Create Draft Modal ---- */}
      <Modal
        title="Create Order"
        open={openCreate}
        onCancel={() => {
          setOpenCreate(false);
          form.resetFields();
          setCustomerSearch('');
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form<CreateOrderInput>
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            label="Customers"
            name="customerId"
            rules={[{ required: true, message: 'Please select a customer' }]}
          >
            <Select
              showSearch
              filterOption={false}
              placeholder="Search customers…"
              onSearch={setCustomerSearch}
              loading={customerSearchQuery.isFetching}
              notFoundContent={
                customerSearchQuery.isFetching ? 'Searching…' : 'Not found'
              }
              options={(customerSearchQuery.data?.data ?? []).map((c) => ({
                value: c.id,
                label: `${c.businessName}${c.taxCode ? ` (${c.taxCode})` : ''}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
