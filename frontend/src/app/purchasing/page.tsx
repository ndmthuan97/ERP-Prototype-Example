'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
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
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { purchasingApi, type PurchaseOrder } from '@/lib/api/purchasing';
import { formatVnd, formatDateTime } from '@/lib/format';
import { StatCard } from '@/components/StatCard';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  placed: 'processing',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'draft', label: 'Draft' },
  { value: 'placed', label: 'Placed' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PurchasingPage() {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const listQuery = useQuery({
    queryKey: ['purchasing', 'orders', { page, limit, q, status }],
    queryFn: () => purchasingApi.list({ page, limit, q: q || undefined, status: status || undefined }),
  });

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
      title: 'Mã PO',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Typography.Link onClick={() => router.push(`/purchasing/${id}`)} style={{ fontWeight: 500 }}>
          {id.slice(0, 8)}…
        </Typography.Link>
      ),
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'supplierId',
      key: 'supplierId',
      render: (id: string) => (
        <Typography.Text copyable={{ text: id }}>
          {id.slice(0, 8)}…
        </Typography.Text>
      ),
    },
    {
      title: 'Số dòng',
      dataIndex: 'lineCount',
      key: 'lineCount',
      align: 'center',
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalCost',
      key: 'totalCost',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Hành động',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chi tiết">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/purchasing/${record.id}`);
              }}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/purchasing/${record.id}/edit`);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Quản lý đơn mua hàng
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />}>
          Tạo đơn mua
        </Button>
      </Space>

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<FileTextOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(22,119,255,0.1)"
            iconColor="#1677ff"
            label="Tổng PO"
            value={totalCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ClockCircleOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(250,173,20,0.1)"
            iconColor="#faad14"
            label="Chờ xử lý"
            value={placedCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CarOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(19,194,194,0.1)"
            iconColor="#13c2c2"
            label="Đang nhận hàng"
            value={partiallyReceivedCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CheckCircleOutlined style={{ fontSize: 24 }} />}
            iconBgColor="rgba(82,196,26,0.1)"
            iconColor="#52c41a"
            label="Đã hoàn thành"
            value={receivedCount}
          />
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Space wrap>
          <Input.Search
            placeholder="Tìm kiếm PO..."
            allowClear
            onSearch={handleSearch}
            style={{ width: 260 }}
          />
          <Select
            value={status}
            onChange={handleStatusChange}
            options={STATUS_OPTIONS}
            style={{ width: 180 }}
            placeholder="Lọc trạng thái"
          />
          <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()}>
            Tải lại
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
            showTotal: (total) => `${total} đơn mua`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>
    </div>
  );
}
