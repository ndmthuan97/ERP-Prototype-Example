'use client';
// =============================================================================
// PO DETAIL PAGE — Purchase Order header + lines + actions
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
  Steps,
  App,
  Spin,
  Alert,
  Card,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { purchasingApi } from '@/lib/api/purchasing';
import { supplierApi } from '@/lib/api/supplier';
import { catalogApi, type Product } from '@/lib/api/catalog';
import type {
  PurchaseOrderDetail,
  PurchaseOrderLine,
  AddPurchaseOrderLineInput,
} from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import Link from 'next/link';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  placed: 'processing',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
};

const STATUS_STEP_MAP: Record<string, number> = {
  draft: 0,
  placed: 1,
  partially_received: 2,
  received: 3,
  cancelled: -1,
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [openAddLine, setOpenAddLine] = useState(false);
  const [form] = Form.useForm<AddPurchaseOrderLineInput>();
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // ---- Queries ----

  const poQuery = useQuery({
    queryKey: ['purchasing', 'orders', id],
    queryFn: () => purchasingApi.get(id),
  });

  const po = poQuery.data;

  const supplierQuery = useQuery({
    queryKey: ['suppliers', po?.supplierId],
    queryFn: () => supplierApi.get(po!.supplierId),
    enabled: !!po?.supplierId,
  });

  const productSearchQuery = useQuery({
    queryKey: ['catalog', 'search', productSearch],
    queryFn: () => catalogApi.list({ q: productSearch, page: 1, limit: 20 }),
    enabled: openAddLine,
  });

  // ---- Mutations ----

  const addLineMutation = useMutation({
    mutationFn: (input: AddPurchaseOrderLineInput) => purchasingApi.addLine(id, input),
    onSuccess: () => {
      message.success('Đã thêm dòng hàng');
      setOpenAddLine(false);
      form.resetFields();
      setSelectedProduct(null);
      setProductSearch('');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const removeLineMutation = useMutation({
    mutationFn: (lineId: string) => purchasingApi.removeLine(id, lineId),
    onSuccess: () => {
      message.success('Đã xóa dòng hàng');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const placeMutation = useMutation({
    mutationFn: () => purchasingApi.place(id),
    onSuccess: () => {
      message.success('Đã đặt đơn mua hàng');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const receiveGoodsMutation = useMutation({
    mutationFn: () => {
      // Receive full remaining qty for all lines
      const lines = (po?.lines ?? [])
        .filter((l) => l.receivedQty < l.orderedQty)
        .map((l) => ({ lineId: l.id, quantity: l.orderedQty - l.receivedQty }));
      return purchasingApi.receiveGoods(id, { lines });
    },
    onSuccess: () => {
      message.success('Đã nhận hàng');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => purchasingApi.cancel(id),
    onSuccess: () => {
      message.success('Đã hủy đơn mua hàng');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  // ---- Product selection ----

  const handleProductSelect = (productId: string) => {
    const products = productSearchQuery.data?.data ?? [];
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      form.setFieldsValue({
        productId: product.id,
        productName: product.name,
        unitCost: product.defaultSalePrice,
      });
    }
  };

  // ---- Lines table ----

  const isDraft = po?.status === 'draft';
  const canReceive = po?.status === 'placed' || po?.status === 'partially_received';

  const lineColumns: ColumnsType<PurchaseOrderLine> = [
    { title: 'Sản phẩm', dataIndex: 'productName', key: 'productName' },
    {
      title: 'SL đặt',
      dataIndex: 'orderedQty',
      key: 'orderedQty',
      align: 'center',
    },
    {
      title: 'SL nhận',
      dataIndex: 'receivedQty',
      key: 'receivedQty',
      align: 'center',
      render: (v: number, record) => (
        <Tag color={v >= record.orderedQty ? 'success' : v > 0 ? 'warning' : 'default'}>
          {v} / {record.orderedQty}
        </Tag>
      ),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'unitCost',
      key: 'unitCost',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Thành tiền',
      key: 'lineTotal',
      align: 'right',
      render: (_, record) => formatVnd(record.orderedQty * record.unitCost),
    },
    ...(isDraft
      ? [
          {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: unknown, record: PurchaseOrderLine) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeLineMutation.mutate(record.id)}
              />
            ),
          },
        ]
      : []),
  ];

  // ---- Loading / Error ----

  if (poQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="Đang tải đơn mua hàng…" />
      </div>
    );
  }

  if (poQuery.isError || !po) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không thể tải đơn mua hàng"
        description={poQuery.error ? toMessage(poQuery.error) : 'Không tìm thấy'}
        action={
          <Button onClick={() => router.push('/purchasing')}>
            Về danh sách
          </Button>
        }
      />
    );
  }

  const stepCurrent = STATUS_STEP_MAP[po.status] ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { title: <Link href="/">Trang chủ</Link> },
          { title: <Link href="/purchasing">Đơn mua hàng</Link> },
          { title: `PO ${id.slice(0, 8)}…` },
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/purchasing')}
          />
          <Typography.Title level={4} style={{ margin: 0 }}>
            Chi tiết đơn mua hàng
          </Typography.Title>
          <Tag color={STATUS_COLOR[po.status] || 'default'} style={{ fontSize: 14 }}>
            {po.status}
          </Tag>
        </Space>

        <Space>
          {isDraft && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={placeMutation.isPending}
              onClick={() => placeMutation.mutate()}
              disabled={(po.lines?.length ?? 0) === 0}
            >
              Đặt hàng
            </Button>
          )}
          {canReceive && (
            <Button
              type="primary"
              icon={<InboxOutlined />}
              loading={receiveGoodsMutation.isPending}
              onClick={() => receiveGoodsMutation.mutate()}
            >
              Nhận hàng (tất cả)
            </Button>
          )}
          {(isDraft || po.status === 'placed') && (
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Hủy
            </Button>
          )}
        </Space>
      </div>

      {/* Status Steps */}
      {po.status !== 'cancelled' ? (
        <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12 }}>
          <Steps
            current={stepCurrent}
            items={[
              { title: 'Nháp', icon: <ClockCircleOutlined /> },
              { title: 'Đã đặt', icon: <SendOutlined /> },
              { title: 'Nhận một phần', icon: <InboxOutlined /> },
              { title: 'Hoàn tất', icon: <CheckCircleOutlined /> },
            ]}
          />
        </Card>
      ) : (
        <Alert type="error" showIcon message="Đơn mua hàng đã bị hủy" />
      )}

      {/* PO Info */}
      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="Mã PO">{id.slice(0, 8)}…</Descriptions.Item>
          <Descriptions.Item label="Nhà cung cấp">
            {supplierQuery.data?.name ?? po.supplierId.slice(0, 8) + '…'}
          </Descriptions.Item>
          <Descriptions.Item label="Tổng tiền">
            <Typography.Text strong>{formatVnd(po.totalCost)}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{formatDateTime(po.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Cập nhật">{formatDateTime(po.updatedAt)}</Descriptions.Item>
          <Descriptions.Item label="Phiên bản">{po.version}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Lines table */}
      <Card
        title={`Dòng hàng (${po.lines?.length ?? 0})`}
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12 }}
        extra={
          isDraft && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setOpenAddLine(true)}
            >
              Thêm dòng
            </Button>
          )
        }
      >
        <Table<PurchaseOrderLine>
          rowKey="id"
          columns={lineColumns}
          dataSource={po.lines ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có dòng hàng nào" /> }}
        />
      </Card>

      {/* Add Line Modal */}
      <Modal
        title="Thêm dòng hàng"
        open={openAddLine}
        onCancel={() => {
          setOpenAddLine(false);
          form.resetFields();
          setSelectedProduct(null);
          setProductSearch('');
        }}
        onOk={() => form.submit()}
        confirmLoading={addLineMutation.isPending}
        okText="Thêm"
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => addLineMutation.mutate(values)}
        >
          <Form.Item
            label="Sản phẩm"
            name="productId"
            rules={[{ required: true, message: 'Chọn sản phẩm' }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={setProductSearch}
              onChange={handleProductSelect}
              placeholder="Tìm sản phẩm..."
              loading={productSearchQuery.isFetching}
              options={(productSearchQuery.data?.data ?? []).map((p) => ({
                value: p.id,
                label: `${p.sku} — ${p.name}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="productName" hidden>
            <input />
          </Form.Item>

          {selectedProduct && (
            <Alert
              type="info"
              message={`${selectedProduct.name} — Giá bán: ${formatVnd(selectedProduct.defaultSalePrice)}`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Số lượng"
            name="orderedQty"
            rules={[
              { required: true, message: 'Nhập số lượng' },
              { type: 'number', min: 1, message: 'Số lượng ≥ 1' },
            ]}
          >
            <InputNumber<number> style={{ width: '100%' }} min={1} precision={0} placeholder="VD: 100" />
          </Form.Item>

          <Form.Item
            label="Đơn giá mua (VND)"
            name="unitCost"
            rules={[
              { required: true, message: 'Nhập đơn giá' },
              { type: 'number', min: 0, message: 'Đơn giá ≥ 0' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={0}
              step={1000}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => Number((v ?? '').replace(/,/g, '')) as number}
              placeholder="VD: 50,000"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
