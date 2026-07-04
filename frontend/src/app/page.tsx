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
// Weekday labels for the revenue chart (JS getDay(): 0=Sun … 6=Sat)
// ---------------------------------------------------------------------------
const WEEKDAY_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// Compact VND → "triệu" label for bar tops (blank for 0 to keep the axis clean)
function formatTrieu(v: number): string {
  if (!v) return '';
  const tr = v / 1_000_000;
  return tr >= 100 ? `${Math.round(tr)}tr` : `${tr.toFixed(1)}tr`;
}

// Fallback donut segments when no real order data available
const FALLBACK_DONUT_SEGMENTS = [
  { label: 'Completed', pct: 45, color: '#10b981' },
  { label: 'Processing', pct: 30, color: '#3b82f6' },
  { label: 'In Transit', pct: 15, color: '#f97316' },
  { label: 'Cancelled', pct: 10, color: '#ef4444' },
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
  confirmed: { label: 'Confirm', color: '#10b981' },
  submitted: { label: 'Processing', color: '#3b82f6' },
  draft: { label: 'Draft', color: '#94a3b8' },
  partially_delivered: { label: 'Partially Delivered', color: '#f97316' },
  fully_delivered: { label: 'Fully Delivered', color: '#06b6d4' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
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

  // Larger fetch feeding the donut breakdown, the 7-day revenue bars, and the
  // revenue KPI — all derived from real orders. Capped at the API max (100).
  const { data: allOrdersData } = useQuery({
    queryKey: ['dashboard', 'orders-all'],
    queryFn: () => salesApi.list({ limit: 100 }),
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

  // Revenue = sum of all fetched orders' totals (excludes cancelled).
  const revenueSum = useMemo(() => {
    return (allOrdersData?.data ?? [])
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [allOrdersData]);

  // Real revenue per day for the last 7 days, bucketed from order createdAt.
  const revenueSeries = useMemo(() => {
    const days: { date: Date; total: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ date: d, total: 0 });
    }
    for (const o of allOrdersData?.data ?? []) {
      if (o.status === 'cancelled') continue;
      const created = new Date(o.createdAt);
      const bucket = days.find((b) => {
        const next = new Date(b.date);
        next.setDate(b.date.getDate() + 1);
        return created >= b.date && created < next;
      });
      if (bucket) bucket.total += o.totalAmount;
    }
    const max = Math.max(1, ...days.map((d) => d.total));
    return days.map((d) => ({
      label: WEEKDAY_VN[d.date.getDay()],
      value: d.total,
      pct: Math.round((d.total / max) * 100),
    }));
  }, [allOrdersData]);

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
              iconBgColor="rgba(6,182,212,0.14)"
              iconColor="#06b6d4"
              label="Total Customers"
              value={customerData?.total ?? loadingPlaceholder}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<ShoppingCartOutlined />}
              iconBgColor="rgba(59,130,246,0.14)"
              iconColor="#3b82f6"
              label="Orders"
              value={ordersData?.meta?.total ?? loadingPlaceholder}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<DollarOutlined />}
              iconBgColor="rgba(249,115,22,0.14)"
              iconColor="#f97316"
              label="Revenue"
              value={allOrdersData ? formatVnd(revenueSum) : loadingPlaceholder}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <StatCard
              icon={<WarningOutlined />}
              iconBgColor="rgba(239,68,68,0.14)"
              iconColor="#ef4444"
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
              iconBgColor="rgba(168,85,247,0.14)"
              iconColor="#a855f7"
              label="Purchase Orders"
              value={poData?.total ?? loadingPlaceholder}
            />
          </Col>
        </Row>
      </Spin>

      {/* Charts */}
      <Row gutter={24} style={{ alignItems: 'stretch' }}>
        {/* Bar Chart — Revenue last 7 days, computed from real orders by day */}
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
              {revenueSeries.map((d, i) => (
                <div key={`${d.label}-${i}`} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 200, display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      className="bar"
                      style={{
                        width: '100%',
                        height: `${d.pct}%`,
                        background: 'var(--brand)',
                        borderRadius: '6px 6px 0 0',
                        position: 'relative',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div className="bar-value">{formatTrieu(d.value)}</div>
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
                    <Typography.Text style={{ color: 'var(--brand)', fontWeight: 600 }}>
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
