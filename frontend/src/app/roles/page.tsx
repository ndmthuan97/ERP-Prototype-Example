'use client';

import { Card, Table, Typography, Tag, Result } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '@/lib/auth/AuthProvider';
import { PERMISSIONS, type PermissionDef } from '@/lib/auth/permissions';

const ROLE_COLORS: Record<string, string> = {
  admin: 'geekblue',
  manager: 'cyan',
  staff: 'default',
  viewer: 'default',
};

export default function RolesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Consistent with the Administration area (Users) — admin-only.
  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="Admins only"
        subTitle="You do not have permission to view roles."
      />
    );
  }

  const columns: ColumnsType<PermissionDef> = [
    {
      title: 'Chức năng',
      dataIndex: 'label',
      key: 'label',
      render: (label: string, rec) => (
        <div>
          <Typography.Text strong>{label}</Typography.Text>
          <div style={{ fontSize: 12, color: '#8A8886' }}>{rec.description}</div>
        </div>
      ),
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 160,
      render: (key: string) => (
        <code style={{ fontSize: 13, color: 'var(--brand)' }}>{key}</code>
      ),
    },
    {
      title: 'Role được phép',
      key: 'roles',
      width: 220,
      render: (_: unknown, rec) => (
        <>
          {rec.roles.map((r) => (
            <Tag key={r} color={ROLE_COLORS[r] ?? 'default'}>
              {r}
            </Tag>
          ))}
        </>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Roles &amp; Permissions
      </Typography.Title>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<PermissionDef>
          rowKey="key"
          size="small"
          columns={columns}
          dataSource={PERMISSIONS}
          pagination={false}
        />
      </Card>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Nguồn: <code>lib/auth/permissions.ts</code>. Role không có trong cột là
        không được phép. Gán role cho user ở trang{' '}
        <a href="/users">Users</a>.
      </Typography.Text>
    </div>
  );
}
