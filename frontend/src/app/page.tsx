'use client';
// =============================================================================
// DASHBOARD — KPI cards + charts + recent tables (live API data)
// =============================================================================
import { useMemo } from 'react';
import { Card, Col, Empty, Row, Spin, Table, Tag, Typography } from 'antd';
import {
  TeamOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  WarningOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '@/components/StatCard';
import { customerApi } from '@/lib/api/customer';
import { salesApi } from '@/lib/api/sales';
import { inventoryApi } from '@/lib/api/inventory';
import { purchasingApi } from '@/lib/api/purchasing';
import { formatVnd, formatDateTime } from '@/lib/format';
import { PO_STATUS } from '@/lib/constants/status';

// ---------------------------------------------------------------------------
// Static demo data — no aggregate/time-series API exists for these yet
// ---------------------------------------------------------------------------
const BAR_DATA = [
  { label: 'T2', value: 320, pct: 64 },
  { label: 'T3', value: 450, pct: 90 },
  { label: 'T4', value: 380, pct: 76 },
  { label: 'T5', value: 500, pct: 100 },
  { label: 'T6', value: 420, pct: 84 },
  { label: 'T7', value: 350, pct: 70 },
  { label: 'CN', value: 280, pct: 56 },
];

// Fallback donut segments when no real order data available
const FALLBACK_DONUT_SEGMENTS = [
  { label: 'Completed', pct: 45, color: '#52c41a' },
  { label: 'Processing', pct: 30, color: '#1677ff' },
  { label: 'In Transit', pct: 15, color: '#faad14' },
  { label: 'Cancelled', pct: 10, color: '#ff4d4f' },
];

const ORDER_STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  submitted: 'processing',
  confirmed: 'success',
  partially_delivered: 'warning',
  fully_delivered: 'cyan',
  cancelled: 'error',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Processing',
  confirmed: 'Confirm',
  partially_delivered: 'Partially Delivered',
  fully_delivered: 'Fully Delivered',
  cancelled: 'Cancelled',
};

// Color mapping for donut chart segments by order status
const STATUS_DONUT_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirm', color: '#52c41a' },
  submitted: { label: 'Processing', color: '#1677ff' },
  draft: { label: 'Draft', color: '#8c8c8c' },
  partially_delivered: { label: 'Partially Delivered', color: '#faad14' },
  fully_delivered: { label: 'Fully Delivered', color: '#13c2c2' },
  cancelled: { label: 'Cancelled', color: '#ff4d4f' },
};

const LOW_STOCK_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Build conic-gradient for donut
// ---------------------------------------------------------------------------
function buildConicGradient(segments: { pct: number; color: string }[]) {
  let acc = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const start = acc;
    acc += seg.pct;
    stops.push(`${seg.color} ${start}% ${acc}%`);
  }
  return `conic-gradient(${stops.join(', ')})`;
}

export default function DashboardPage() {
  // -------------------------------------------------------------------------
  // API Queries
  // -------------------------------------------------------------------------
  const { data: customerData, isLoading: customersLoading } = useQuery({
    queryKey: ['dashboard', 'customers'],
    queryFn: () => customerApi.list({ limit: 1 }),
    staleTime: 60_000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['dashboard', 'orders'],
    queryFn: () => salesApi.list({ limit: 5 }),
    staleTime: 30_000,
  });

  // Larger fetch for donut chart status breakdown
  const { data: allOrdersData } = useQuery({
    queryKey: ['dashboard', 'orders-all'],
    queryFn: () => salesApi.list({ limit: 20 }),
    staleTime: 60_000,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['dashboard', 'inventory'],
    queryFn: () => inventoryApi.list({ limit: 100 }),
    staleTime: 60_000,
  });

  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ['dashboard', 'purchasing'],
    queryFn: () => purchasingApi.list({ limit: 5 }),
    staleTime: 60_000,
  });

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------

  // Low-stock items: quantityAvailable < LOW_STOCK_THRESHOLD, sorted ascending, top 5
  const lowStockItems = useMemo(() => {
    if (!inventoryData?.data) return [];
    return inventoryData.data
      .filter((item) => item.quantityAvailable < LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.quantityAvailable - b.quantityAvailable)
      .slice(0, 5)
      .map((item) => ({
        key: item.id,
        name: item.name,
        sku: item.sku,
        stock: item.quantityAvailable,
        status: item.quantityAvailable <= 10 ? 'critical' : 'low',
      }));
  }, [inventoryData]);

  const lowStockCount = useMemo(() => {
    if (!inventoryData?.data) return 0;
    return inventoryData.data.filter(
      (item) => item.quantityAvailable < LOW_STOCK_THRESHOLD,
    ).length;
  }, [inventoryData]);

  // Revenue sum from the fetched orders list (visible page, not all-time)
  const revenueSum = useMemo(() => {
    if (!ordersData?.data) return 0;
    return ordersData.data.reduce((sum, o) => sum + o.totalAmount, 0);
  }, [ordersData]);

  // Recent orders mapped for the table
  const recentOrders = useMemo(() => {
    if (!ordersData?.data) return [];
    return ordersData.data.map((o) => ({
      key: o.id,
      id: o.id.slice(0, 8).toUpperCase(),
      customer: `${o.customerId.slice(0, 8)}…`,
      total: o.totalAmount,
      status: o.status,
      date: formatDateTime(o.createdAt),
    }));
  }, [ordersData]);

  // Recent POs
  const recentPOs = useMemo(() => {
    if (!poData?.data) return [];
    return poData.data.map((po) => ({
      key: po.id,
      id: po.id.slice(0, 8).toUpperCase(),
      total: po.totalCost,
      status: po.status,
      lines: po.lineCount,
      date: formatDateTime(po.createdAt),
    }));
  }, [poData]);

  // Donut chart segments computed from real order status distribution
  const donutSegments = useMemo(() => {
    const source = allOrdersData?.data;
    if (!source || source.length === 0) return FALLBACK_DONUT_SEGMENTS;

    const countByStatus: Record<string, number> = {};
    for (const o of source) {
      countByStatus[o.status] = (countByStatus[o.status] ?? 0) + 1;
    }

    const total = source.length;
    const segments = Object.entries(countByStatus)
      .map(([status, count]) => ({
        label: STATUS_DONUT_CONFIG[status]?.label ?? status,
        pct: Math.round((count / total) * 100),
        color: STATUS_DONUT_CONFIG[status]?.color ?? '#d9d9d9',
      }))
      .sort((a, b) => b.pct - a.pct);

    // Ensure percentages sum to 100 by adjusting the largest segment
    const pctSum = segments.reduce((s, seg) => s + seg.pct, 0);
    if (segments.length > 0 && pctSum !== 100) {
      segments[0].pct += 100 - pctSum;
    }

    return segments;
  }, [allOrdersData]);

  // -------------------------------------------------------------------------
  // Loading helper
  // -------------------------------------------------------------------------
  const anyLoading = customersLoading || ordersLoading || inventoryLoading;
  const loadingPlaceholder = '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Dashboard
          </Typography.Title>
          <Typography.Text type="secondary">
            Business Overview
          </Typography.Text>
        </div>
      </div>

      {/* KPI Cards */}
      <Spin spinning={anyLoading} tip="Loading data…">
        <Row gutter={16}>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<TeamOutlined />}
              iconBgColor="rgba(22,119,255,0.1)"
              iconColor="#1677ff"
              label="Total Customers"
              value={customerData?.total ?? loadingPlaceholder}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<ShoppingCartOutlined />}
              iconBgColor="rgba(82,196,26,0.1)"
              iconColor="#52c41a"
              label="Orders"
              value={ordersData?.meta?.total ?? loadingPlaceholder}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<DollarOutlined />}
              iconBgColor="rgba(250,173,20,0.1)"
              iconColor="#faad14"
              label="Revenue (current page)"
              value={ordersData ? formatVnd(revenueSum) : loadingPlaceholder}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<WarningOutlined />}
              iconBgColor="rgba(255,77,79,0.1)"
              iconColor="#ff4d4f"
              label="Inventory warnings"
              value={inventoryData ? lowStockCount : loadingPlaceholder}
              trend={
                lowStockCount > 0
                  ? { text: 'Need to restock', color: 'red' }
                  : undefined
              }
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<FileTextOutlined />}
              iconBgColor="rgba(114,46,209,0.1)"
              iconColor="#722ed1"
              label="Purchase Orders"
              value={poData?.total ?? loadingPlaceholder}
            />
          </Col>
        </Row>
      </Spin>

      {/* Charts */}
      <Row gutter={24} style={{ alignItems: 'stretch' }}>
        {/* Bar Chart — Revenue 7 days (static demo data, no time-series API) */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Typography.Text strong style={{ fontSize: 16 }}>
                Revenue (Last 7 Days)
              </Typography.Text>
            }
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div className="bar-chart">
              {BAR_DATA.map((d) => (
                <div key={d.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 200, display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      className="bar"
                      style={{
                        width: '100%',
                        height: `${d.pct}%`,
                        background: '#1677ff',
                        borderRadius: '4px 4px 0 0',
                        position: 'relative',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div className="bar-value">{d.value}tr</div>
                    </div>
                  </div>
                  <div className="bar-label">{d.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Donut Chart — Order status (computed from real data when available) */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Typography.Text strong style={{ fontSize: 16 }}>
                Order Distribution
              </Typography.Text>
            }
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              <div
                className="donut-chart"
                style={{ background: buildConicGradient(donutSegments) }}
              >
                <div className="donut-hole">
                  <span className="donut-total">100%</span>
                  <span className="donut-label">Total</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {donutSegments.map((seg) => (
                  <div
                    key={seg.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="legend-dot" style={{ background: seg.color }} />
                      <Typography.Text style={{ fontSize: 13 }}>{seg.label}</Typography.Text>
                    </div>
                    <Typography.Text strong style={{ fontSize: 13 }}>
                      {seg.pct}%
                    </Typography.Text>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Tables */}
      <Row gutter={24} style={{ alignItems: 'stretch' }}>
        {/* Recent Orders */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Typography.Text strong style={{ fontSize: 16 }}>
                Orders Recent
              </Typography.Text>
            }
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={recentOrders}
              loading={ordersLoading}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="No orders yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              columns={[
                {
                  title: 'Order ID',
                  dataIndex: 'id',
                  key: 'id',
                  render: (v: string) => (
                    <Typography.Text style={{ color: '#1677ff', fontWeight: 500 }}>
                      {v}
                    </Typography.Text>
                  ),
                },
                { title: 'Customers', dataIndex: 'customer', key: 'customer' },
                {
                  title: 'Total Amount',
                  dataIndex: 'total',
                  key: 'total',
                  align: 'right',
                  render: (v: number) => formatVnd(v),
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s: string) => (
                    <Tag color={ORDER_STATUS_COLOR[s]}>
                      {ORDER_STATUS_LABEL[s] ?? s}
                    </Tag>
                  ),
                },
                { title: 'Created', dataIndex: 'date', key: 'date' },
              ]}
            />
          </Card>
        </Col>

        {/* Low Stock Products */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Typography.Text strong style={{ fontSize: 16 }}>
                Products Low Stock
              </Typography.Text>
            }
            style={{ borderRadius: 12, height: '100%' }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={lowStockItems}
              loading={inventoryLoading}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="All All products in stock" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              columns={[
                { title: 'Products', dataIndex: 'name', key: 'name' },
                {
                  title: 'SKU',
                  dataIndex: 'sku',
                  key: 'sku',
                  render: (v: string) => (
                    <Typography.Text code style={{ fontSize: 12 }}>
                      {v}
                    </Typography.Text>
                  ),
                },
                {
                  title: 'Inventory',
                  dataIndex: 'stock',
                  key: 'stock',
                  align: 'center',
                  render: (v: number) => (
                    <Typography.Text style={{ fontWeight: 600, color: v <= 5 ? '#ff4d4f' : '#faad14' }}>
                      {v}
                    </Typography.Text>
                  ),
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s: string) =>
                    s === 'critical' ? (
                      <Tag color="error">Out of Stock</Tag>
                    ) : (
                      <Tag color="warning">Low Stock</Tag>
                    ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
