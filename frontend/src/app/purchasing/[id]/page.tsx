'use client';
// =============================================================================
// PO DETAIL PAGE — Purchase Order header + lines + actions
// =============================================================================

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tag,
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  InputNumber,
  Select,
  App,
  Spin,
  Alert,
  Card,
  Tabs,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  DeleteOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { purchasingApi } from '@/lib/api/purchasing';
import { supplierApi } from '@/lib/api/supplier';
import { catalogApi, type Product } from '@/lib/api/catalog';
import type {
  PurchaseOrderLine,
  AddPurchaseOrderLineInput,
} from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import { FormSection, Field } from '@/components/d365/FormLayout';
import { CommandBar } from '@/components/d365/CommandBar';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  placed: 'processing',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
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
  const [openReceive, setOpenReceive] = useState(false);
  const [form] = Form.useForm<AddPurchaseOrderLineInput>();
  const [receiveForm] = Form.useForm();
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
      message.success('Line item added');
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
      message.success('Line item removed');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const placeMutation = useMutation({
    mutationFn: () => purchasingApi.place(id),
    onSuccess: () => {
      message.success('Purchase order placed');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const receiveGoodsMutation = useMutation({
    mutationFn: (lineInputs: Array<{ lineId: string; quantity: number }>) => {
      return purchasingApi.receiveGoods(id, { lines: lineInputs });
    },
    onSuccess: () => {
      message.success('Goods received');
      setOpenReceive(false);
      receiveForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'orders', id] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleReceiveAll = () => {
    const lines = (po?.lines ?? [])
      .filter((l) => l.receivedQty < l.orderedQty)
      .map((l) => ({ lineId: l.id, quantity: l.orderedQty - l.receivedQty }));
    receiveGoodsMutation.mutate(lines);
  };

  const handleReceivePerLine = (values: Record<string, number>) => {
    const lines = Object.entries(values)
      .filter(([, qty]) => qty > 0)
      .map(([lineId, quantity]) => ({ lineId, quantity }));
    if (lines.length === 0) {
      message.warning('Please enter at least one quantity');
      return;
    }
    receiveGoodsMutation.mutate(lines);
  };

  const cancelMutation = useMutation({
    mutationFn: () => purchasingApi.cancel(id),
    onSuccess: () => {
      message.success('Cancelled purchase order');
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
    { title: 'Products', dataIndex: 'productName', key: 'productName' },
    {
      title: 'Ordered',
      dataIndex: 'orderedQty',
      key: 'orderedQty',
      align: 'center',
    },
    {
      title: 'Received',
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
      title: 'Unit Price',
      dataIndex: 'unitCost',
      key: 'unitCost',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Total',
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
        <Spin size="large" tip="Loading purchase order…" />
      </div>
    );
  }

  if (poQuery.isError || !po) {
    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load purchase order"
        description={poQuery.error ? toMessage(poQuery.error) : 'Not found'}
        action={
          <Button onClick={() => router.push('/purchasing')}>
            Back to list
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <Space align="center" size={12}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          PO {id.slice(0, 8)}…
        </Typography.Title>
        <Tag color={STATUS_COLOR[po.status] || 'default'}>{po.status}</Tag>
      </Space>

      {/* D365 command bar */}
      <CommandBar>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push('/purchasing')}>
          Back
        </Button>
        {isDraft && (
          <Button
            type="text"
            icon={<SendOutlined />}
            loading={placeMutation.isPending}
            onClick={() => placeMutation.mutate()}
            disabled={(po.lines?.length ?? 0) === 0}
          >
            Place Order
          </Button>
        )}
        {canReceive && (
          <>
            <Button
              type="text"
              icon={<InboxOutlined />}
              loading={receiveGoodsMutation.isPending}
              onClick={handleReceiveAll}
            >
              Receive All
            </Button>
            <Button
              type="text"
              icon={<InboxOutlined />}
              onClick={() => setOpenReceive(true)}
            >
              Receive Per Line
            </Button>
          </>
        )}
        {(isDraft || po.status === 'placed') && (
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            Cancel
          </Button>
        )}
      </CommandBar>

      {/* D365-style tabbed form: General tab with sectioned fields + lines */}
      <Card style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}>
        <Tabs
          defaultActiveKey="general"
          items={[
            {
              key: 'general',
              label: 'General',
              children: (
                <Space direction="vertical" size={28} style={{ width: '100%' }}>
                  <FormSection title="Purchase order details">
                    <Field label="PO ID">
                      <Typography.Text keyboard>{id.slice(0, 8)}…</Typography.Text>
                    </Field>
                    <Field label="Suppliers">
                      {supplierQuery.data?.name ?? po.supplierId.slice(0, 8) + '…'}
                    </Field>
                    <Field label="Status">
                      <Tag color={STATUS_COLOR[po.status] || 'default'}>{po.status}</Tag>
                    </Field>
                    <Field label="Total Amount">
                      <Typography.Text strong>{formatVnd(po.totalCost)}</Typography.Text>
                    </Field>
                    <Field label="Lines">{po.lines?.length ?? 0}</Field>
                    <Field label="Created">{formatDateTime(po.createdAt)}</Field>
                    <Field label="Updated">{formatDateTime(po.updatedAt)}</Field>
                    <Field label="Version">{po.version}</Field>
                  </FormSection>

                  <section>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                      }}
                    >
                      <Typography.Text strong style={{ color: 'var(--surface-muted)', fontSize: 13 }}>
                        Line items ({po.lines?.length ?? 0})
                      </Typography.Text>
                      {isDraft && (
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => setOpenAddLine(true)}
                        >
                          Add Line
                        </Button>
                      )}
                    </div>
                    <Table<PurchaseOrderLine>
                      rowKey="id"
                      size="small"
                      columns={lineColumns}
                      dataSource={po.lines ?? []}
                      pagination={false}
                      locale={{ emptyText: <Empty description="No line items yet" /> }}
                    />
                  </section>
                </Space>
              ),
            },
            { key: 'related', label: 'Related', disabled: true },
          ]}
        />
      </Card>

      {/* Add Line Modal */}
      <Modal
        title="Add Line Item"
        open={openAddLine}
        onCancel={() => {
          setOpenAddLine(false);
          form.resetFields();
          setSelectedProduct(null);
          setProductSearch('');
        }}
        onOk={() => form.submit()}
        confirmLoading={addLineMutation.isPending}
        okText="Add"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => addLineMutation.mutate(values)}
        >
          <Form.Item
            label="Products"
            name="productId"
            rules={[{ required: true, message: 'Select product' }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={setProductSearch}
              onChange={handleProductSelect}
              placeholder="Search products..."
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
              message={`${selectedProduct.name} — Sale Price: ${formatVnd(selectedProduct.defaultSalePrice)}`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Quantity"
            name="orderedQty"
            rules={[
              { required: true, message: 'Enter quantity' },
              { type: 'number', min: 1, message: 'Quantity ≥ 1' },
            ]}
          >
            <InputNumber<number> style={{ width: '100%' }} min={1} precision={0} placeholder="VD: 100" />
          </Form.Item>

          <Form.Item
            label="Unit Price mua (VND)"
            name="unitCost"
            rules={[
              { required: true, message: 'Enter unit price' },
              { type: 'number', min: 0, message: 'Unit Price ≥ 0' },
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

      {/* Receive Per Line Modal */}
      <Modal
        title="Receive Goods Per Line"
        open={openReceive}
        onCancel={() => {
          setOpenReceive(false);
          receiveForm.resetFields();
        }}
        onOk={() => receiveForm.submit()}
        confirmLoading={receiveGoodsMutation.isPending}
        okText="Receive"
        cancelText="Cancel"
        destroyOnHidden
        width={600}
      >
        <Form
          form={receiveForm}
          layout="vertical"
          onFinish={handleReceivePerLine}
        >
          {(po?.lines ?? [])
            .filter((l) => l.receivedQty < l.orderedQty)
            .map((line) => (
              <Form.Item
                key={line.id}
                name={line.id}
                label={
                  <Space>
                    <span style={{ fontWeight: 500 }}>{line.productName}</span>
                    <span style={{ color: 'var(--surface-muted)' }}>
                      (Remaining: {line.orderedQty - line.receivedQty} / {line.orderedQty})
                    </span>
                  </Space>
                }
                initialValue={0}
                rules={[
                  {
                    type: 'number',
                    max: line.orderedQty - line.receivedQty,
                    message: `Max ${line.orderedQty - line.receivedQty}`,
                  },
                ]}
              >
                <InputNumber<number>
                  style={{ width: '100%' }}
                  min={0}
                  max={line.orderedQty - line.receivedQty}
                  precision={0}
                  placeholder={`0 – ${line.orderedQty - line.receivedQty}`}
                />
              </Form.Item>
            ))}
          {(po?.lines ?? []).filter((l) => l.receivedQty < l.orderedQty).length === 0 && (
            <Alert type="success" message="All lines fully received" />
          )}
        </Form>
      </Modal>
    </div>
  );
}
