'use client';
// =============================================================================
// ORDER DETAIL PAGE — header + lines + add line + delivery/return tabs
// =============================================================================

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Breadcrumb,
  Descriptions,
  Tag,
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  InputNumber,
  Select,
  Timeline,
  App,
  Tooltip,
  Alert,
  Spin,
  Card,
  Row,
  Col,
  Steps,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  CarryOutOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { salesApi } from '@/lib/api/sales';
import { customerApi } from '@/lib/api/customer';
import { inventoryApi } from '@/lib/api/inventory';
import { catalogApi, type Product } from '@/lib/api/catalog';
import type {
  SalesOrder,
  SalesOrderLine,
  OrderStatus,
  AddLineInput,
  StockItem,
} from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import { DeliveryTab } from '@/components/orders/DeliveryTab';
import { ReturnTab } from '@/components/orders/ReturnTab';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CAN } from '@/lib/auth/permissions';
import { ORDER_STATUS, statusLabel } from '@/lib/constants/status';

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  confirmed: 'success',
  partially_delivered: 'warning',
  fully_delivered: 'cyan',
  cancelled: 'error',
};

// Timeline dot colors per status
const TIMELINE_DOT_COLOR: Record<string, string> = {
  draft: 'gray',
  submitted: 'blue',
  confirmed: 'green',
  partially_delivered: 'orange',
  fully_delivered: 'cyan',
  cancelled: 'red',
};

const TIMELINE_ICON: Record<string, React.ReactNode> = {
  draft: <ClockCircleOutlined />,
  submitted: <SendOutlined />,
  confirmed: <CheckCircleOutlined />,
  partially_delivered: <CarryOutOutlined />,
  fully_delivered: <CheckCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
};

// Map order status to step index for the Steps component
const STATUS_STEP_INDEX: Record<OrderStatus, number> = {
  draft: 0,
  submitted: 1,
  confirmed: 2,
  partially_delivered: 3,
  fully_delivered: 4,
  cancelled: -1,
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [openAddLine, setOpenAddLine] = useState(false);
  const [form] = Form.useForm<AddLineInput>();
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [catalogProduct, setCatalogProduct] = useState<Product | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';

  // ---- Queries ----

  const orderQuery = useQuery({
    queryKey: ['orders', id],
    queryFn: () => salesApi.get(id),
  });

  const order = orderQuery.data;

  // Fetch customer name (H7 bug workaround: customer_name always empty)
  const customerQuery = useQuery({
    queryKey: ['customers', order?.customerId],
    queryFn: () => customerApi.get(order!.customerId),
    enabled: !!order?.customerId,
  });

  const lifecycleQuery = useQuery({
    queryKey: ['orders', id, 'lifecycle'],
    queryFn: () => salesApi.lifecycle(id),
    enabled: !!order,
  });

  // Inventory search for add-line modal
  const itemSearchQuery = useQuery({
    queryKey: ['inventory', 'search', itemSearch],
    queryFn: () => inventoryApi.list({ q: itemSearch, page: 1, limit: 20 }),
    enabled: openAddLine,
  });

  // ---- Mutations ----

  const addLineMutation = useMutation({
    mutationFn: (input: AddLineInput) => salesApi.addLine(id, input),
    onSuccess: () => {
      message.success('Line item added');
      setOpenAddLine(false);
      form.resetFields();
      setSelectedItem(null);
      setItemSearch('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (err) => {
      message.error(toMessage(err));
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => salesApi.submit(id),
    onSuccess: () => {
      message.success('Order submitted');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (err) => {
      message.error(toMessage(err));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => salesApi.cancel(id, reason || 'Cancelled from UI'),
    onSuccess: () => {
      message.success('Order cancelled');
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (err) => {
      message.error(toMessage(err));
    },
  });

  const removeLineMutation = useMutation({
    mutationFn: (lineId: string) => salesApi.removeLine(id, lineId),
    onSuccess: () => {
      message.success('Line item removed');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (err) => {
      message.error(toMessage(err));
    },
  });

  // ---- Item selection handler ----

  const handleItemSelect = async (itemId: string) => {
    const items = itemSearchQuery.data?.data ?? [];
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setSelectedItem(item);
      form.setFieldsValue({ itemId: item.id, itemName: item.name });

      // Cross-lookup catalog product by SKU for price and taxRate
      try {
        const product = await catalogApi.get(item.sku);
        setCatalogProduct(product);
        form.setFieldsValue({
          unitPrice: product.defaultSalePrice,
          taxRate: product.taxRate,
        });
      } catch {
        setCatalogProduct(null);
      }
    }
  };


  // ---- Lines table columns ----

  const isDraftStatus = order?.status === 'draft';

  const lineColumns: ColumnsType<SalesOrderLine> = [
    { title: 'Item', dataIndex: 'itemName', key: 'itemName' },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Tax',
      dataIndex: 'taxRate',
      key: 'taxRate',
      align: 'center',
      render: (v: number) => `${((v ?? 0) * 100).toFixed(0)}%`,
    },
    {
      title: 'Total',
      dataIndex: 'lineTotal',
      key: 'lineTotal',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    ...(isDraftStatus
      ? [
          {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: unknown, record: SalesOrderLine) => (
              <Tooltip title="Remove">
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  loading={
                    removeLineMutation.isPending &&
                    removeLineMutation.variables === record.id
                  }
                  onClick={() => removeLineMutation.mutate(record.id)}
                />
              </Tooltip>
            ),
          },
        ]
      : []),
  ];

  // ---- Loading / Error states ----

  if (orderQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="Loading order…" />
      </div>
    );
  }

  if (orderQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load order"
        description={toMessage(orderQuery.error)}
        action={
          <Button onClick={() => router.push('/orders')}>
            Back to list
          </Button>
        }
      />
    );
  }

  if (!order) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Order not found"
        action={
          <Button onClick={() => router.push('/orders')}>
            Back to list
          </Button>
        }
      />
    );
  }

  const isDraft = order.status === 'draft';
  const isCancelled = order.status === 'cancelled';
  const customerName =
    customerQuery.data?.businessName ?? order.customerId.slice(0, 8) + '…';

  // ---- Steps logic ----
  const currentStepIndex = STATUS_STEP_INDEX[order.status];

  // Build steps items from lifecycle data or use static fallback
  const staticSteps = [
    { title: 'Created', icon: <FileTextOutlined /> },
    { title: 'Submitted', icon: <SendOutlined /> },
    { title: 'Confirmed', icon: <CheckCircleOutlined /> },
    { title: 'Delivered', icon: <CarryOutOutlined /> },
  ];

  const lifecycleEvents = lifecycleQuery.data?.timeline ?? [];

  // Determine which step statuses from lifecycle events have occurred
  const completedStatuses = new Set(lifecycleEvents.map((e) => e.status));

  const stepsItems = staticSteps.map((step, index) => {
    let status: 'finish' | 'process' | 'wait' | 'error' = 'wait';

    if (isCancelled) {
      // Mark all steps up to where cancellation happened, then error
      if (index <= Math.max(currentStepIndex, 0)) {
        status = 'finish';
      }
      // Show error on the current "active" step (use submitted index if cancelled after submit, etc.)
      const lastCompletedStep = lifecycleEvents.length > 0
        ? Math.max(
            ...lifecycleEvents
              .filter((e) => e.status !== 'cancelled')
              .map((e) => STATUS_STEP_INDEX[e.status as OrderStatus] ?? -1),
          )
        : 0;
      if (index === lastCompletedStep) {
        status = 'error';
      } else if (index > lastCompletedStep) {
        status = 'wait';
      } else {
        status = 'finish';
      }
    } else if (index < currentStepIndex) {
      status = 'finish';
    } else if (index === currentStepIndex) {
      status = 'process';
    }

    return {
      title: step.title,
      icon: step.icon,
      status,
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ---- Breadcrumb ---- */}
      <Breadcrumb
        items={[
          { title: 'Dashboard', href: '/' },
          { title: 'Orders', href: '/orders' },
          { title: `#${id.slice(0, 8)}` },
        ]}
      />

      {/* ---- Order Header Card ---- */}
      <Card
        styles={{ body: { padding: 24 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <Space size="middle" align="center">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/orders')}
            >
              Back
            </Button>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Order #{id.slice(0, 8)}
            </Typography.Title>
            <Tag
              color={ORDER_STATUS.color[order.status]}
              style={{ fontSize: 14, padding: '2px 12px' }}
            >
              {statusLabel(ORDER_STATUS.label, order.status)}
            </Tag>
          </Space>

          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={!isDraft}
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              Submit
            </Button>

            <Button
              danger
              icon={<CloseCircleOutlined />}
              disabled={order.status === 'cancelled'}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(cancelReason)}
            >
              Cancel
            </Button>
          </Space>
        </div>

        {/* Key-value info row */}
        <Row gutter={24}>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Customer
            </Typography.Text>
            <div style={{ fontWeight: 500, fontSize: 15, marginTop: 4 }}>
              {customerQuery.isLoading ? <Spin size="small" /> : customerName}
            </div>
          </Col>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Created
            </Typography.Text>
            <div style={{ fontWeight: 500, fontSize: 15, marginTop: 4 }}>
              {formatDateTime(order.createdAt)}
            </div>
          </Col>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Updated
            </Typography.Text>
            <div style={{ fontWeight: 500, fontSize: 15, marginTop: 4 }}>
              {formatDateTime(order.updatedAt)}
            </div>
          </Col>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Total
            </Typography.Text>
            <div
              style={{
                fontWeight: 600,
                fontSize: 18,
                marginTop: 4,
                color: '#1677ff',
              }}
            >
              {formatVnd(order.totalAmount)}
            </div>
          </Col>
        </Row>
      </Card>

      {/* ---- Steps Progress ---- */}
      <Card
        title="Order Progress"
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
        styles={{ body: { padding: '24px 32px' } }}
      >
        <Steps
          current={isCancelled ? undefined : currentStepIndex}
          items={stepsItems}
        />
        {isCancelled && order.cancelReason && (
          <Alert
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
            message="Order has been cancelled"
            description={order.cancelReason}
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* ---- Two-column Info Section ---- */}
      <Row gutter={24}>
        <Col span={12}>
          <Card
            title={
              <Space>
                <UserOutlined style={{ color: '#1677ff' }} />
                <span>Customer Info</span>
              </Space>
            }
            style={{ borderRadius: 12, border: '1px solid #f0f0f0', height: '100%' }}
          >
            <Descriptions column={1} colon={false} size="small">
              <Descriptions.Item label="Name">
                {customerQuery.isLoading ? (
                  <Spin size="small" />
                ) : (
                  <Typography.Text strong>{customerName}</Typography.Text>
                )}
              </Descriptions.Item>
              {customerQuery.data?.contactPhone && (
                <Descriptions.Item label="Phone">
                  {customerQuery.data.contactPhone}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Customer ID">
                <Typography.Text copyable type="secondary">
                  {order.customerId}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={
              <Space>
                <ShoppingCartOutlined style={{ color: '#1677ff' }} />
                <span>Order Info</span>
              </Space>
            }
            style={{ borderRadius: 12, border: '1px solid #f0f0f0', height: '100%' }}
          >
            <Descriptions column={1} colon={false} size="small">
              <Descriptions.Item label="Order ID">
                <Typography.Text copyable>{order.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={ORDER_STATUS_COLOR[order.status]}>
                  {order.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {formatDateTime(order.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {formatDateTime(order.updatedAt)}
              </Descriptions.Item>
              {order.cancelReason && (
                <Descriptions.Item label="Cancel Reason">
                  <Typography.Text type="danger">
                    {order.cancelReason}
                  </Typography.Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* ---- Order Lines ---- */}
      <Card
        title="Line Items"
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
        extra={
          isDraft && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => setOpenAddLine(true)}
            >
              Add Line
            </Button>
          )
        }
      >
        <Table<SalesOrderLine>
          rowKey="id"
          columns={lineColumns}
          dataSource={order.lines}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No line items yet' }}
        />

        {/* Summary footer */}
        <div
          style={{
            marginTop: 16,
            borderTop: '1px solid #f0f0f0',
            paddingTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 48,
              paddingRight: 16,
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                Subtotal
              </Typography.Text>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4 }}>
                {formatVnd(order.subtotalAmount)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                Tax
              </Typography.Text>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: '#8c8c8c' }}>
                {formatVnd(order.totalTaxAmount)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                Grand Total
              </Typography.Text>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#1677ff',
                  marginTop: 4,
                }}
              >
                {formatVnd(order.totalAmount)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ---- Lifecycle Timeline ---- */}
      <Card
        title="Order History"
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        {lifecycleQuery.isLoading ? (
          <Spin />
        ) : lifecycleQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Failed to load history"
            description={toMessage(lifecycleQuery.error)}
          />
        ) : (
          <Timeline
            items={(lifecycleQuery.data?.timeline ?? []).map((evt) => ({
              color: TIMELINE_DOT_COLOR[evt.status] ?? 'gray',
              dot: TIMELINE_ICON[evt.status] ?? <ExclamationCircleOutlined />,
              children: (
                <div>
                  <Tag color={ORDER_STATUS.color[evt.status] ?? 'default'}>
                    {statusLabel(ORDER_STATUS.label, evt.status)}
                  </Tag>
                  <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                    {formatDateTime(evt.timestamp)}
                  </Typography.Text>
                  {evt.actor && (
                    <Typography.Text style={{ marginLeft: 8 }}>
                      — {evt.actor}
                    </Typography.Text>
                  )}
                  {evt.note && (
                    <div>
                      <Typography.Text type="secondary">
                        {evt.note}
                      </Typography.Text>
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Card>

      {/* ---- Add Line Modal ---- */}
      <Modal
        title="Add Line Item"
        open={openAddLine}
        onCancel={() => {
          setOpenAddLine(false);
          form.resetFields();
          setSelectedItem(null);
          setCatalogProduct(null);
          setItemSearch('');
        }}
        onOk={() => form.submit()}
        confirmLoading={addLineMutation.isPending}
        okText="Add"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form<AddLineInput>
          form={form}
          layout="vertical"
          onFinish={(values) => addLineMutation.mutate(values)}
        >
          <Form.Item
            label="Product"
            name="itemId"
            rules={[{ required: true, message: 'Please select a product' }]}
          >
            <Select
              showSearch
              filterOption={false}
              placeholder="Search products…"
              onSearch={setItemSearch}
              onChange={handleItemSelect}
              loading={itemSearchQuery.isFetching}
              notFoundContent={
                itemSearchQuery.isFetching ? 'Searching…' : 'No results'
              }
              options={(itemSearchQuery.data?.data ?? []).map((item) => ({
                value: item.id,
                label: `${item.name} (SKU: ${item.sku}) — Stock: ${item.quantityAvailable}`,
              }))}
            />
          </Form.Item>

          {/* Hidden field for itemName — auto-filled on item select */}
          <Form.Item name="itemName" hidden>
            <input type="hidden" />
          </Form.Item>

          {selectedItem && (
            <Alert
              type="info"
              showIcon
              message={`${selectedItem.name} — In Stock: ${selectedItem.quantityAvailable}${catalogProduct ? ` — List Price: ${new Intl.NumberFormat('en-US').format(catalogProduct.defaultSalePrice)} — Tax: ${(catalogProduct.taxRate * 100).toFixed(0)}%` : ''}`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Quantity"
            name="quantity"
            rules={[
              { required: true, message: 'Please enter quantity' },
              {
                type: 'number',
                min: 1,
                message: 'Quantity must be ≥ 1',
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="e.g. 10"
            />
          </Form.Item>

          <Form.Item
            label="Unit Price (VND)"
            name="unitPrice"
            rules={[
              { required: true, message: 'Please enter unit price' },
              {
                type: 'number',
                min: 0,
                message: 'Price must be ≥ 0',
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              step={1000}
              formatter={(v) =>
                `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              }
              parser={(v) => Number((v ?? '').replace(/,/g, '')) as number}
              placeholder="e.g. 150,000"
            />
          </Form.Item>

          <Form.Item
            label="Tax Rate"
            name="taxRate"
            initialValue={0.10}
            rules={[
              { required: true, message: 'Please select tax rate' },
            ]}
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
        </Form>
      </Modal>

      {/* ---- Delivery & Return Tabs ---- */}
      <Card style={{ borderRadius: 12 }}>
        <Tabs
          items={[
            {
              key: 'delivery',
              label: 'Deliveries',
              children: (
                <DeliveryTab
                  orderId={id}
                  orderLines={order.lines}
                  orderStatus={order.status}
                />
              ),
            },
            {
              key: 'returns',
              label: 'Returns',
              children: (
                <ReturnTab
                  orderId={id}
                  orderLines={order.lines}
                  orderStatus={order.status}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
