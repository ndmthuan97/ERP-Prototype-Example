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

  // Fetch all items for accurate stat card computation
  const statsQuery = useQuery({
    queryKey: ['inventory', 'stats-all'],
    queryFn: () => inventoryApi.list({ page: 1, limit: 9999 }),
    staleTime: 30_000,
  });

  // ---------------------------------------------------------------------------
  // Derived stat values from API data
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    const items = statsQuery.data?.data ?? [];
    const totalProducts = statsQuery.data?.total ?? 0;
    const totalStock = items.reduce((sum, i) => sum + i.quantityAvailable, 0);
    const lowStockCount = items.filter(
      (i) => i.quantityAvailable > 0 && i.quantityAvailable <= 20,
    ).length;
    const outOfStockCount = items.filter(
      (i) => i.quantityAvailable === 0,
    ).length;

    return { totalProducts, totalStock, lowStockCount, outOfStockCount };
  }, [statsQuery.data]);

  const createMutation = useMutation({
    mutationFn: (input: CreateItemInput) => inventoryApi.create(input),
    onSuccess: () => {
      message.success('Đã tạo sản phẩm');
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
      message.success(`Đã nhập kho ${vars.quantity} đơn vị cho ${vars.sku}`);
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
    { title: 'Tên', dataIndex: 'name', key: 'name' },
    {
      title: 'SL khả dụng',
      dataIndex: 'quantityAvailable',
      key: 'quantityAvailable',
      align: 'right',
      render: (v: number) => (
        <span style={{ color: getQuantityColor(v), fontWeight: 600 }}>
          {v.toLocaleString('vi-VN')}
        </span>
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
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/inventory/${encodeURIComponent(record.sku)}`)}
            />
          </Tooltip>
          <Tooltip title="Nhập kho">
            <Button
              type="text"
              size="small"
              icon={<ImportOutlined />}
              onClick={() => setReceiveTarget(record)}
            />
          </Tooltip>
          <Tooltip title="Kiểm tra tồn">
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
          Tồn kho
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpenCreate(true)}
        >
          Tạo sản phẩm
        </Button>
      </div>

      {/* Stats Row */}
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<AppstoreOutlined />}
            iconBgColor="rgba(22,119,255,0.1)"
            iconColor="#1677ff"
            label="Tổng sản phẩm"
            value={statsQuery.data ? String(stats.totalProducts) : '—'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<DollarOutlined />}
            iconBgColor="rgba(82,196,26,0.1)"
            iconColor="#52c41a"
            label="Tổng tồn kho"
            value={statsQuery.data ? stats.totalStock.toLocaleString('vi-VN') : '—'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<WarningOutlined />}
            iconBgColor="rgba(250,173,20,0.1)"
            iconColor="#faad14"
            label="Sắp hết hàng"
            value={statsQuery.data ? String(stats.lowStockCount) : '—'}
            trend={{
              text: stats.lowStockCount > 0
                ? `${stats.lowStockCount} sản phẩm cần nhập thêm`
                : 'Đủ hàng',
              color: stats.lowStockCount > 0 ? 'orange' : 'green',
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<StopOutlined />}
            iconBgColor="rgba(255,77,79,0.1)"
            iconColor="#ff4d4f"
            label="Hết hàng"
            value={statsQuery.data ? String(stats.outOfStockCount) : '—'}
            trend={{
              text: stats.outOfStockCount > 0
                ? 'Cần nhập ngay'
                : 'Tất cả còn hàng',
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
            placeholder="Tìm theo SKU hoặc tên…"
            style={{ width: 320 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()}>
            Tải lại
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
            showTotal: (total) => `${total} sản phẩm`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      {/* ---- Create Item Modal ---- */}
      <Modal
        title="Tạo sản phẩm"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Tạo"
        cancelText="Hủy"
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
              { required: true, message: 'Vui lòng nhập SKU' },
              { min: 2, max: 64, message: 'SKU từ 2–64 ký tự' },
            ]}
          >
            <Input placeholder="VD: SP-001" />
          </Form.Item>
          <Form.Item
            label="Tên sản phẩm"
            name="name"
            rules={[
              { required: true, message: 'Vui lòng nhập tên' },
              { min: 2, message: 'Tối thiểu 2 ký tự' },
            ]}
          >
            <Input placeholder="Sản phẩm ABC" />
          </Form.Item>
          <Form.Item
            label="Số lượng ban đầu"
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
        title={`Nhập kho — ${receiveTarget?.sku ?? ''}`}
        open={!!receiveTarget}
        onCancel={() => {
          setReceiveTarget(null);
          receiveForm.resetFields();
        }}
        onOk={() => receiveForm.submit()}
        confirmLoading={receiveMutation.isPending}
        okText="Nhập kho"
        cancelText="Hủy"
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
            label="Số lượng nhập"
            name="quantity"
            rules={[
              { required: true, message: 'Vui lòng nhập số lượng' },
              { type: 'number', min: 1, message: 'Số lượng phải ≥ 1' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="Nhập số lượng"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Availability Check Modal ---- */}
      <Modal
        title={`Kiểm tra tồn — ${availTarget?.sku ?? ''}`}
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
            label="Số lượng cần kiểm tra"
            name="quantity"
            rules={[
              { required: true, message: 'Vui lòng nhập số lượng' },
              { type: 'number', min: 1, message: 'Số lượng phải ≥ 1' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="Nhập số lượng"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={availLoading}>
              Kiểm tra
            </Button>
          </Form.Item>
        </Form>

        {availResult && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Statistic title="Khả dụng" value={availResult.available} />
            </Col>
            <Col span={6}>
              <Statistic title="Đã giữ" value={availResult.reserved} />
            </Col>
            <Col span={6}>
              <Statistic title="Tổng" value={availResult.total} />
            </Col>
            <Col span={6}>
              <Statistic
                title="Có thể giữ"
                valueRender={() => (
                  <Badge
                    status={availResult.canReserve ? 'success' : 'error'}
                    text={availResult.canReserve ? 'Có' : 'Không'}
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
