'use client';
// =============================================================================
// APP SHELL — layout chung: Sider menu + Header (breadcrumb + user) + content
// =============================================================================
import { Layout, Menu, Typography, Badge, Avatar, Breadcrumb, Space, Spin, Tooltip } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  BellOutlined,
  BookOutlined,
  FileTextOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

const { Header, Sider, Content } = Layout;

const MENU = [
  { key: '/', icon: <DashboardOutlined />, label: <Link href="/">Dashboard</Link> },
  { key: '/customers', icon: <TeamOutlined />, label: <Link href="/customers">Khách hàng</Link> },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: <Link href="/orders">Đơn hàng</Link> },
  { key: '/inventory', icon: <AppstoreOutlined />, label: <Link href="/inventory">Tồn kho</Link> },
  { key: '/catalog', icon: <BookOutlined />, label: <Link href="/catalog">Danh mục sản phẩm</Link> },
  { key: '/purchasing', icon: <FileTextOutlined />, label: <Link href="/purchasing">Đơn mua hàng</Link> },
];

// Map pathname segments to breadcrumb labels
const BREADCRUMB_MAP: Record<string, string> = {
  '': 'Dashboard',
  customers: 'Khách hàng',
  inventory: 'Tồn kho',
  orders: 'Đơn hàng',
  catalog: 'Danh mục sản phẩm',
  purchasing: 'Đơn mua hàng',
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const items: { title: ReactNode }[] = [{ title: <Link href="/">Trang chủ</Link> }];

  let path = '';
  for (const seg of segments) {
    path += `/${seg}`;
    const label = BREADCRUMB_MAP[seg];
    if (label) {
      items.push({ title: <Link href={path}>{label}</Link> });
    } else {
      items.push({ title: <span>{seg.length > 12 ? `${seg.slice(0, 8)}…` : seg}</span> });
    }
  }
  return items;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  // Login page: no shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Auth loading: show centered spinner
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Not authenticated: AuthProvider will redirect, render nothing
  if (!user) {
    return null;
  }

  const selected =
    MENU.map((m) => m.key)
      .filter((k) => k !== '/' && pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? '/';

  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        theme="light"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 20,
          background: '#fff',
          overflow: 'auto',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 12,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1677ff, #4096ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            W
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 15, display: 'block', lineHeight: 1.2, color: '#141414' }}>
              WeCare ERP
            </Typography.Text>
            <Typography.Text style={{ fontSize: 11, color: '#8c8c8c' }}>
              Enterprise Admin
            </Typography.Text>
          </div>
        </div>

        {/* Navigation */}
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={MENU}
          style={{ border: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: 240 }}>
        {/* Header */}
        <Header
          style={{
            background: '#fff',
            paddingInline: 24,
            height: 64,
            lineHeight: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Breadcrumb items={breadcrumbs} />

          <Space size={16} align="center">
            <Badge dot={false} size="small">
              <BellOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
            </Badge>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar
                size={32}
                style={{ background: '#1677ff', cursor: 'pointer' }}
              >
                {user.name[0].toUpperCase()}
              </Avatar>
              <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                {user.name}
              </Typography.Text>
            </div>
            <Tooltip title="Đăng xuất">
              <LogoutOutlined
                onClick={logout}
                style={{ fontSize: 16, color: '#595959', cursor: 'pointer' }}
              />
            </Tooltip>
          </Space>
        </Header>

        {/* Content */}
        <Content
          style={{
            margin: 0,
            padding: 24,
            background: '#f0f2f5',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
