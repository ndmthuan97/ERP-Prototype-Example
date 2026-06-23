'use client';
// =============================================================================
// PHASE 3 — CHI TIẾT ĐƠN HÀNG: header + lines + add line + lifecycle timeline
// =============================================================================
// Bug H7: customer_name always empty in lifecycle — fetch customer separately.
// SAGA_ENABLED = false → Submit/Cancel buttons shown disabled with tooltip.

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
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { salesApi, SAGA_ENABLED } from '@/lib/api/sales';
import { customerApi } from '@/lib/api/customer';
import { inventoryApi } from '@/lib/api/inventory';
import type {
  SalesOrder,
  SalesOrderLine,
  OrderStatus,
  AddLineInput,
  StockItem,
} from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';

const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  draft: 'default',
  submitted: 'processing',
  confirmed: 'success',
  fulfilled: 'cyan',
  cancelled: 'error',
};

// Timeline dot colors per status
const TIMELINE_DOT_COLOR: Record<string, string> = {
  draft: 'gray',
  submitted: 'blue',
  confirmed: 'green',
  fulfilled: 'cyan',
  cancelled: 'red',
};

const TIMELINE_ICON: Record<string, React.ReactNode> = {
  draft: <ClockCircleOutlined />,
  submitted: <SendOutlined />,
  confirmed: <CheckCircleOutlined />,
  fulfilled: <CheckCircleOutlined />,
  cancelled: <CloseCircleOutlined />,
};

// Map order status to step index for the Steps component
const STATUS_STEP_INDEX: Record<OrderStatus, number> = {
  draft: 0,
  submitted: 1,
  confirmed: 2,
  fulfilled: 3,
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
      message.success('Đã thêm dòng hàng');
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
      message.success('Đã gửi đơn hàng');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (err) => {
      message.error(toMessage(err));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => salesApi.cancel(id, 'Hủy từ giao diện'),
    onSuccess: () => {
      message.success('Đã hủy đơn hàng');
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
    },
    onError: (err) => {
      message.error(toMessage(err));
    },
  });

  // ---- Item selection handler ----

  const handleItemSelect = (itemId: string) => {
    const items = itemSearchQuery.data?.data ?? [];
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setSelectedItem(item);
      form.setFieldsValue({ itemId: item.id, itemName: item.name });
    }
  };

  // ---- Lines table columns ----

  const lineColumns: ColumnsType<SalesOrderLine> = [
    { title: 'Tên hàng', dataIndex: 'itemName', key: 'itemName' },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'lineTotal',
      key: 'lineTotal',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
  ];

  // ---- Loading / Error states ----

  if (orderQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="Đang tải đơn hàng…" />
      </div>
    );
  }

  if (orderQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không thể tải đơn hàng"
        description={toMessage(orderQuery.error)}
        action={
          <Button onClick={() => router.push('/orders')}>
            Về danh sách
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
        message="Không tìm thấy đơn hàng"
        action={
          <Button onClick={() => router.push('/orders')}>
            Về danh sách
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
    { title: 'Tạo đơn', icon: <FileTextOutlined /> },
    { title: 'Gửi đơn', icon: <SendOutlined /> },
    { title: 'Xác nhận', icon: <CheckCircleOutlined /> },
    { title: 'Hoàn thành', icon: <CarryOutOutlined /> },
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
          { title: 'Tổng quan', href: '/' },
          { title: 'Đơn hàng', href: '/orders' },
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
              Danh sách
            </Button>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Đơn hàng #{id.slice(0, 8)}
            </Typography.Title>
            <Tag
              color={ORDER_STATUS_COLOR[order.status]}
              style={{ fontSize: 14, padding: '2px 12px' }}
            >
              {order.status}
            </Tag>
          </Space>

          <Space>
            {/* Saga-gated Submit button */}
            <Tooltip
              title={
                SAGA_ENABLED
                  ? undefined
                  : 'Saga chưa sẵn sàng (BE cần fix C1+C2)'
              }
            >
              <Button
                type="primary"
                icon={<SendOutlined />}
                disabled={!SAGA_ENABLED || !isDraft}
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                Gửi đơn
              </Button>
            </Tooltip>

            {/* Saga-gated Cancel button */}
            <Tooltip
              title={
                SAGA_ENABLED
                  ? undefined
                  : 'Saga chưa sẵn sàng (BE cần fix C1+C2)'
              }
            >
              <Button
                danger
                icon={<CloseCircleOutlined />}
                disabled={!SAGA_ENABLED || order.status === 'cancelled'}
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                Hủy đơn
              </Button>
            </Tooltip>
          </Space>
        </div>

        {/* Key-value info row */}
        <Row gutter={24}>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Khách hàng
            </Typography.Text>
            <div style={{ fontWeight: 500, fontSize: 15, marginTop: 4 }}>
              {customerQuery.isLoading ? <Spin size="small" /> : customerName}
            </div>
          </Col>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Ngày tạo
            </Typography.Text>
            <div style={{ fontWeight: 500, fontSize: 15, marginTop: 4 }}>
              {formatDateTime(order.createdAt)}
            </div>
          </Col>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Cập nhật
            </Typography.Text>
            <div style={{ fontWeight: 500, fontSize: 15, marginTop: 4 }}>
              {formatDateTime(order.updatedAt)}
            </div>
          </Col>
          <Col span={6}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Tổng tiền
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
        title="Tiến trình đơn hàng"
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
            message="Đơn hàng đã bị hủy"
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
                <span>Thông tin khách hàng</span>
              </Space>
            }
            style={{ borderRadius: 12, border: '1px solid #f0f0f0', height: '100%' }}
          >
            <Descriptions column={1} colon={false} size="small">
              <Descriptions.Item label="Tên khách hàng">
                {customerQuery.isLoading ? (
                  <Spin size="small" />
                ) : (
                  <Typography.Text strong>{customerName}</Typography.Text>
                )}
              </Descriptions.Item>
              {customerQuery.data?.contactPhone && (
                <Descriptions.Item label="Số điện thoại">
                  {customerQuery.data.contactPhone}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Mã khách hàng">
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
                <span>Thông tin đơn hàng</span>
              </Space>
            }
            style={{ borderRadius: 12, border: '1px solid #f0f0f0', height: '100%' }}
          >
            <Descriptions column={1} colon={false} size="small">
              <Descriptions.Item label="Mã đơn">
                <Typography.Text copyable>{order.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={ORDER_STATUS_COLOR[order.status]}>
                  {order.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {formatDateTime(order.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật">
                {formatDateTime(order.updatedAt)}
              </Descriptions.Item>
              {order.cancelReason && (
                <Descriptions.Item label="Lý do hủy">
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
        title="Dòng hàng"
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
        extra={
          isDraft && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => setOpenAddLine(true)}
            >
              Thêm dòng
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
          locale={{ emptyText: 'Chưa có dòng hàng nào' }}
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
                Tạm tính
              </Typography.Text>
              <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4 }}>
                {formatVnd(order.totalAmount)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                Tổng cộng
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
        title="Lịch sử đơn hàng"
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        {lifecycleQuery.isLoading ? (
          <Spin />
        ) : lifecycleQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Không thể tải lịch sử"
            description={toMessage(lifecycleQuery.error)}
          />
        ) : (
          <Timeline
            items={(lifecycleQuery.data?.timeline ?? []).map((evt) => ({
              color: TIMELINE_DOT_COLOR[evt.status] ?? 'gray',
              dot: TIMELINE_ICON[evt.status] ?? <ExclamationCircleOutlined />,
              children: (
                <div>
                  <Tag color={ORDER_STATUS_COLOR[evt.status as OrderStatus] ?? 'default'}>
                    {evt.status}
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
        title="Thêm dòng hàng"
        open={openAddLine}
        onCancel={() => {
          setOpenAddLine(false);
          form.resetFields();
          setSelectedItem(null);
          setItemSearch('');
        }}
        onOk={() => form.submit()}
        confirmLoading={addLineMutation.isPending}
        okText="Thêm"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form<AddLineInput>
          form={form}
          layout="vertical"
          onFinish={(values) => addLineMutation.mutate(values)}
        >
          <Form.Item
            label="Sản phẩm"
            name="itemId"
            rules={[{ required: true, message: 'Vui lòng chọn sản phẩm' }]}
          >
            <Select
              showSearch
              filterOption={false}
              placeholder="Tìm sản phẩm…"
              onSearch={setItemSearch}
              onChange={handleItemSelect}
              loading={itemSearchQuery.isFetching}
              notFoundContent={
                itemSearchQuery.isFetching ? 'Đang tìm…' : 'Không tìm thấy'
              }
              options={(itemSearchQuery.data?.data ?? []).map((item) => ({
                value: item.id,
                label: `${item.name} (SKU: ${item.sku}) — Tồn: ${item.quantityAvailable}`,
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
              message={`${selectedItem.name} — Tồn kho: ${selectedItem.quantityAvailable}`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Số lượng"
            name="quantity"
            rules={[
              { required: true, message: 'Vui lòng nhập số lượng' },
              {
                type: 'number',
                min: 1,
                message: 'Số lượng phải ≥ 1',
              },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="VD: 10"
            />
          </Form.Item>

          <Form.Item
            label="Đơn giá (VND)"
            name="unitPrice"
            rules={[
              { required: true, message: 'Vui lòng nhập đơn giá' },
              {
                type: 'number',
                min: 0,
                message: 'Đơn giá phải ≥ 0',
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
              placeholder="VD: 150,000"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
