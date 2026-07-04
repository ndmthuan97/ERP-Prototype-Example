'use client';
// =============================================================================
// PHASE 3 — ĐƠN HÀNG: list + filter trạng thái + phân trang + tạo draft
// =============================================================================
// Pagination uses PaginatedMeta<T> (nested meta) — different from Customer/Inventory.
// Create draft: pick customer via async search → createDraft → navigate to detail.
// Submit/Cancel actions are on the order detail page.

import { useState, useCallback, type Key } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Button,
  Typography,
  Tag,
  Modal,
  Form,
  Select,
  App,
  Alert,
  Card,
  Tooltip,
  DatePicker,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  DownOutlined,
  MoreOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  TableOutlined,
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
import { ORDER_STATUS, statusLabel } from '@/lib/constants/status';
import { CommandBar } from '@/components/d365/CommandBar';

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  // Async customer search state
  const [customerSearch, setCustomerSearch] = useState('');

  // D365 view-picker: the ORDER STATUS enum presented as named views (Power Apps
  // view selector). Selecting a view drives the existing status filter.
  const VIEWS: { key: string; label: string; value: string }[] = [
    { key: 'all', label: 'All Orders', value: '' },
    { key: 'draft', label: 'Draft', value: 'draft' },
    { key: 'submitted', label: 'Submitted', value: 'submitted' },
    { key: 'confirmed', label: 'Confirmed', value: 'confirmed' },
    { key: 'partially_delivered', label: 'Partially Delivered', value: 'partially_delivered' },
    { key: 'fully_delivered', label: 'Fully Delivered', value: 'fully_delivered' },
    { key: 'cancelled', label: 'Cancelled', value: 'cancelled' },
  ];
  const currentView = VIEWS.find((v) => v.value === status) ?? VIEWS[0];

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
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (id: string, record) => (
        <Typography.Link
          strong
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/orders/${record.id}`);
          }}
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
      sorter: (a, b) => a.totalAmount - b.totalAmount,
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
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Tooltip title="Details">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/orders/${record.id}`);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  // ---- Pagination (PaginatedMeta format) ----

  const meta = listQuery.data?.meta;

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
              handleStatusChange(next?.value ?? '');
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

        <DatePicker.RangePicker
          style={{ width: 260 }}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setDateRange([dates[0].toISOString(), dates[1].toISOString()]);
            } else {
              setDateRange(null);
            }
            setPage(1);
          }}
          placeholder={['From date', 'To date']}
        />
      </CommandBar>

      {listQuery.isError && (
        <Alert
          type="error"
          showIcon
          message="Failed to load orders"
          description={toMessage(listQuery.error)}
        />
      )}

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<SalesOrderSummary>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={listQuery.data?.data ?? []}
          loading={listQuery.isFetching}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onRow={(record) => ({
            onClick: () => router.push(`/orders/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: meta?.page ?? page,
            pageSize: meta?.limit ?? limit,
            total: meta?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `Rows: ${total}`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

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
