'use client';
// =============================================================================
// PAGE SKELETON — loading placeholder for list pages (stat cards + table)
// =============================================================================

import { Skeleton, Card, Row, Col, Space } from 'antd';

/** Skeleton for stat card rows */
function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Row gutter={16}>
      {Array.from({ length: count }, (_, i) => (
        <Col key={i} xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
            styles={{ body: { padding: 20, minHeight: 120 } }}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Skeleton.Input active size="small" style={{ width: 80, height: 14 }} />
              <Skeleton.Input active size="large" style={{ width: 100, height: 28 }} />
            </Space>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

/** Skeleton for table with header */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card
      styles={{ body: { padding: 0 } }}
      style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
    >
      <div style={{ padding: 16 }}>
        <Skeleton active paragraph={{ rows }} />
      </div>
    </Card>
  );
}

/** Full page skeleton for list views: page title + stat cards + filter bar + table */
export function PageSkeleton({
  statCards = 4,
  tableRows = 5,
}: {
  statCards?: number;
  tableRows?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Title bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton.Input active style={{ width: 200, height: 28 }} />
        <Skeleton.Button active style={{ width: 140 }} />
      </div>

      {/* Stat cards */}
      {statCards > 0 && <StatCardsSkeleton count={statCards} />}

      {/* Filter bar */}
      <Card
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Space>
          <Skeleton.Input active style={{ width: 260 }} />
          <Skeleton.Button active />
        </Space>
      </Card>

      {/* Table */}
      <TableSkeleton rows={tableRows} />
    </div>
  );
}

/** Detail page skeleton: breadcrumb + header + descriptions card */
export function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Skeleton.Input active size="small" style={{ width: 300, height: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Skeleton.Button active shape="circle" size="small" />
          <Skeleton.Input active style={{ width: 200, height: 24 }} />
        </Space>
        <Space>
          <Skeleton.Button active style={{ width: 80 }} />
          <Skeleton.Button active style={{ width: 100 }} />
        </Space>
      </div>
      <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    </div>
  );
}
