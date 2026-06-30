'use client';
// =============================================================================
// APP SHELL — layout chung: Sider menu + Header (breadcrumb + user) + content
// =============================================================================
import { Layout, Menu, Typography, Avatar, Breadcrumb, Space, Spin, Tooltip, Grid, Drawer, Dropdown } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  BookOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserSwitchOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';

const { Header, Sider, Content } = Layout;

const MENU = [
  { key: '/', icon: <DashboardOutlined />, label: <Link href="/">Dashboard</Link> },
  { key: '/customers', icon: <TeamOutlined />, label: <Link href="/customers">Customers</Link> },
  { key: '/orders', icon: <ShoppingCartOutlined />, label: <Link href="/orders">Orders</Link> },
  { key: '/inventory', icon: <AppstoreOutlined />, label: <Link href="/inventory">Inventory</Link> },
  { key: '/catalog', icon: <BookOutlined />, label: <Link href="/catalog">Product Catalog</Link> },
  {
    key: '/purchasing',
    icon: <FileTextOutlined />,
    label: 'Purchasing',
    children: [
      { key: '/purchasing', label: <Link href="/purchasing">Purchase Orders</Link> },
      { key: '/purchasing/suppliers', label: <Link href="/purchasing/suppliers">Suppliers</Link> },
    ],
  },
];

// Map pathname segments to breadcrumb labels
const BREADCRUMB_MAP: Record<string, string> = {
  '': 'Dashboard',
  customers: 'Customers',
  inventory: 'Inventory',
  orders: 'Orders',
  catalog: 'Product Catalog',
  purchasing: 'Purchasing',
  suppliers: 'Suppliers',
};

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const items: { title: ReactNode }[] = [{ title: <Link href="/">Home</Link> }];

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
  const screens = Grid.useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);

  const isMobile = !screens.md;

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
        collapsedWidth={isMobile ? 0 : 80}
        collapsed={collapsed || isMobile}
        collapsible
        trigger={null}
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
            padding: collapsed && !isMobile ? '0 24px' : '0 20px',
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
              flexShrink: 0,
            }}
          >
            W
          </div>
          {!collapsed && !isMobile && (
            <div>
              <Typography.Text strong style={{ fontSize: 15, display: 'block', lineHeight: 1.2, color: '#141414' }}>
                WeCare ERP
              </Typography.Text>
              <Typography.Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                Enterprise Admin
              </Typography.Text>
            </div>
          )}
        </div>

        {/* Navigation */}
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          defaultOpenKeys={['/purchasing']}
          items={MENU}
          style={{ border: 'none', marginTop: 8 }}
          onClick={() => {
            if (isMobile) setCollapsed(true);
          }}
        />
      </Sider>

      {/* Mobile drawer overlay */}
      {isMobile && (
        <Drawer
          placement="left"
          open={!collapsed && isMobile}
          onClose={() => setCollapsed(true)}
          width={240}
          styles={{ body: { padding: 0 } }}
          closable={false}
        >
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
          <Menu
            mode="inline"
            selectedKeys={[selected]}
            defaultOpenKeys={['/purchasing']}
            items={MENU}
            style={{ border: 'none', marginTop: 8 }}
            onClick={() => setCollapsed(true)}
          />
        </Drawer>
      )}

      <Layout style={{ marginLeft: collapsed || isMobile ? (isMobile ? 0 : 80) : 240, transition: 'margin-left 0.2s' }}>
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
          <Space>
            {isMobile && (
              <div style={{ cursor: 'pointer', fontSize: 18 }} onClick={() => setCollapsed(!collapsed)}>
                <MenuUnfoldOutlined />
              </div>
            )}
            {!isMobile && (
              <div style={{ cursor: 'pointer', fontSize: 18 }} onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </div>
            )}
            <Breadcrumb items={breadcrumbs} />
          </Space>

          <Space size={16} align="center">
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'profile',
                    icon: <UserOutlined />,
                    label: (
                      <div>
                        <div style={{ fontWeight: 500 }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>{user.email}</div>
                      </div>
                    ),
                    disabled: true,
                  },
                  { type: 'divider' },
                  {
                    key: 'settings',
                    icon: <SettingOutlined />,
                    label: 'Settings',
                    disabled: true,
                  },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: 'Sign Out',
                    danger: true,
                    onClick: logout,
                  },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar
                  size={32}
                  style={{ background: '#1677ff' }}
                >
                  {user.name[0].toUpperCase()}
                </Avatar>
                {!isMobile && (
                  <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                    {user.name}
                  </Typography.Text>
                )}
              </div>
            </Dropdown>
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
