'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Card,
  Input,
  Select,
  Tooltip,
  Modal,
  Form,
  App,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { purchasingApi, type PurchaseOrder } from '@/lib/api/purchasing';
import { supplierApi } from '@/lib/api/supplier';
import type { Supplier, CreatePurchaseOrderInput } from '@/lib/api/types';
import { formatVnd, formatDateTime } from '@/lib/format';
import { toMessage } from '@/lib/api/errors';
import { StatCard } from '@/components/StatCard';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  placed: 'processing',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'placed', label: 'Placed' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PurchasingPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [openCreate, setOpenCreate] = useState(false);
  const [form] = Form.useForm<CreatePurchaseOrderInput>();

  const listQuery = useQuery({
    queryKey: ['purchasing', 'orders', { page, limit, q, status }],
    queryFn: () => purchasingApi.list({ page, limit, q: q || undefined, status: status || undefined }),
  });

  // Fetch suppliers for name display + create modal
  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => supplierApi.list({ limit: 200 }),
  });

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of suppliersQuery.data?.data ?? []) {
      map.set(s.id, s.name);
    }
    return map;
  }, [suppliersQuery.data]);

  const ordersData = listQuery.data?.data ?? [];
  const totalCount = listQuery.data?.total ?? 0;

  const placedCount = useMemo(
    () => ordersData.filter((o) => o.status === 'placed').length,
    [ordersData],
  );

  const partiallyReceivedCount = useMemo(
    () => ordersData.filter((o) => o.status === 'partially_received').length,
    [ordersData],
  );

  const receivedCount = useMemo(
    () => ordersData.filter((o) => o.status === 'received').length,
    [ordersData],
  );

  const createMutation = useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) => purchasingApi.create(input),
    onSuccess: (data) => {
      message.success('Purchase order created');
      setOpenCreate(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['purchasing'] });
      router.push(`/purchasing/${data.id}`);
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const columns: ColumnsType<PurchaseOrder> = [
    {
      title: 'PO ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Typography.Link onClick={() => router.push(`/purchasing/${id}`)} style={{ fontWeight: 500 }}>
          {id.slice(0, 8)}…
        </Typography.Link>
      ),
    },
    {
      title: 'Suppliers',
      dataIndex: 'supplierId',
      key: 'supplierId',
      render: (id: string) => supplierMap.get(id) ?? id.slice(0, 8) + '…',
    },
    {
      title: 'Lines',
      dataIndex: 'lineCount',
      key: 'lineCount',
      align: 'center',
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalCost',
      key: 'totalCost',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '',
      key: 'actions',
      align: 'center',
      width: 60,
      render: (_, record) => (
        <Tooltip title="Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/purchasing/${record.id}`);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Purchase Order Management
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenCreate(true)}>
          Create purchase orders
        </Button>
      </Space>

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<FileTextOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(22,119,255,0.1)"
            iconColor="#1677ff"
            label="Total POs"
            value={totalCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ClockCircleOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(250,173,20,0.1)"
            iconColor="#faad14"
            label="Pending"
            value={placedCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CarOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(19,194,194,0.1)"
            iconColor="#13c2c2"
            label="Receiving"
            value={partiallyReceivedCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CheckCircleOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(82,196,26,0.1)"
            iconColor="#52c41a"
            label="Completed"
            value={receivedCount}
          />
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Space wrap>
          <Input.Search
            placeholder="Search PO..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 260 }}
          />
          <Select
            value={status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            style={{ width: 180 }}
            placeholder="Filter by status"
          />
          <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()}>
            Reload
          </Button>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
        <Table<PurchaseOrder>
          rowKey="id"
          columns={columns}
          dataSource={ordersData}
          loading={listQuery.isFetching}
          onRow={(record) => ({
            onClick: () => router.push(`/purchasing/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total: totalCount,
            showSizeChanger: true,
            showTotal: (total) => `${total} purchase orders`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      {/* Create PO Modal */}
      <Modal
        title="Create purchase order"
        open={openCreate}
        onCancel={() => { setOpenCreate(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            label="Suppliers"
            name="supplierId"
            rules={[{ required: true, message: 'Select supplier' }]}
          >
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
              }
              placeholder="Select supplier..."
              loading={suppliersQuery.isFetching}
              options={(suppliersQuery.data?.data ?? [])
                .filter((s) => s.isActive)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
