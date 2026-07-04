'use client';
// =============================================================================
// APP SHELL — sakai-ng style layout (light/dark aware via CSS vars):
//   top bar (logo + configurator + user, subtle bottom border)  ▲
//   ├─ sidebar (uppercase section headers, primary active pill)
//   └─ ground content
// Surface colors come from --surface-* CSS vars that flip on the `.dark` class.
// =============================================================================
import { Layout, Menu, Typography, Avatar, Space, Spin, Grid, Drawer, Dropdown } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  BookOutlined,
  FileTextOutlined,
  ShopOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  SettingOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AUTH_BYPASS } from '@/lib/auth/bypass';
import { Configurator } from '@/components/Configurator';

const { Header, Sider, Content } = Layout;

const WECARE_LOGO =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzs5qXKTVnBQ5bm8S-plT1OPmxXnFi-KqU0EAiWYdtCV9T8nNMxjvsWnk&s=10';

const HEADER_H = 60;
const SIDER_W = 250;
const SIDER_W_COLLAPSED = 72;

// Flat list of all navigable keys — used to compute the active selection.
const NAV_KEYS = ['/', '/customers', '/orders', '/inventory', '/catalog', '/purchasing', '/purchasing/suppliers', '/users', '/roles'];

// Leaf entries. When the sidebar is COLLAPSED we render these flat (icon rail,
// no section headers).
const NAV = {
  dashboard: { key: '/', icon: <DashboardOutlined />, label: <Link href="/">Dashboard</Link> },
  customers: { key: '/customers', icon: <TeamOutlined />, label: <Link href="/customers">Customers</Link> },
  orders: { key: '/orders', icon: <ShoppingCartOutlined />, label: <Link href="/orders">Orders</Link> },
  inventory: { key: '/inventory', icon: <AppstoreOutlined />, label: <Link href="/inventory">Inventory</Link> },
  catalog: { key: '/catalog', icon: <BookOutlined />, label: <Link href="/catalog">Product Catalog</Link> },
  purchaseOrders: { key: '/purchasing', icon: <FileTextOutlined />, label: <Link href="/purchasing">Purchase Orders</Link> },
  suppliers: { key: '/purchasing/suppliers', icon: <ShopOutlined />, label: <Link href="/purchasing/suppliers">Suppliers</Link> },
  users: { key: '/users', icon: <IdcardOutlined />, label: <Link href="/users">Users</Link> },
  roles: { key: '/roles', icon: <SafetyCertificateOutlined />, label: <Link href="/roles">Roles &amp; Permissions</Link> },
};

// Administration area — only shown to admins (endpoints are role-gated).
const ADMIN_GROUP = { key: 'grp-admin', label: 'Administration', children: [NAV.users, NAV.roles] };

const LEAF_ITEMS = [
  NAV.dashboard,
  NAV.customers,
  NAV.orders,
  NAV.inventory,
  NAV.catalog,
  NAV.purchaseOrders,
  NAV.suppliers,
];

// Collapsible site-map sections (used when the sidebar is expanded).
const GROUP_KEYS = ['grp-home', 'grp-sales', 'grp-operations', 'grp-purchasing'];
const GROUPED_ITEMS = [
  { key: 'grp-home', label: 'Home', children: [NAV.dashboard] },
  { key: 'grp-sales', label: 'Sales', children: [NAV.customers, NAV.orders] },
  { key: 'grp-operations', label: 'Operations', children: [NAV.inventory, NAV.catalog] },
  { key: 'grp-purchasing', label: 'Purchasing', children: [NAV.purchaseOrders, NAV.suppliers] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const screens = Grid.useBreakpoint();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    NAV_KEYS
      .filter((k) => k !== '/' && pathname.startsWith(k))
      .sort((a, b) => b.length - a.length)[0] ?? '/';

  // Administration area only for admins.
  const isAdmin = user.role === 'admin';
  const groupedItems = isAdmin ? [...GROUPED_ITEMS, ADMIN_GROUP] : GROUPED_ITEMS;
  const leafItems = isAdmin ? [...LEAF_ITEMS, NAV.users, NAV.roles] : LEAF_ITEMS;
  const openKeys = isAdmin ? [...GROUP_KEYS, 'grp-admin'] : GROUP_KEYS;

  const userMenu = (
    <Dropdown
      menu={{
        items: [
          {
            key: 'profile',
            icon: <UserOutlined />,
            label: (
              <div>
                <div style={{ fontWeight: 500 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--surface-muted)' }}>{user.email}</div>
              </div>
            ),
            disabled: true,
          },
          { type: 'divider' },
          { key: 'settings', icon: <SettingOutlined />, label: 'Settings', disabled: true },
          { type: 'divider' },
          { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', danger: true, onClick: logout },
        ],
      }}
      placement="bottomRight"
      trigger={['click']}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <Avatar size={32} style={{ background: 'var(--brand)', color: '#fff', fontWeight: 700 }}>
          {(user.name?.[0] ?? '?').toUpperCase()}
        </Avatar>
        {!isMobile && (
          <Typography.Text style={{ fontSize: 13, fontWeight: 600, color: 'var(--surface-text)' }}>
            {user.name}
          </Typography.Text>
        )}
      </div>
    </Dropdown>
  );

  const siteMap = (
    <Menu
      className="app-sider"
      mode="inline"
      inlineIndent={16}
      selectedKeys={[selected]}
      defaultOpenKeys={openKeys}
      items={collapsed && !isMobile ? leafItems : groupedItems}
      style={{ border: 'none', background: 'transparent' }}
      onClick={() => isMobile && setMobileNavOpen(false)}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sakai menu: uppercase gray section headers, primary active pill, soft hover */}
      <style>{`
        .app-sider .ant-menu-item-selected::after { opacity: 0 !important; }
        .app-sider .ant-menu-item-selected { font-weight: 600; }
        /* Section headers styled like sakai's uppercase labels */
        .app-sider:not(.ant-menu-inline-collapsed) .ant-menu-submenu-title {
          font-weight: 700;
          color: #94a3b8 !important;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          height: 34px !important;
          line-height: 34px !important;
        }
        .app-sider:not(.ant-menu-inline-collapsed) .ant-menu-submenu-title .ant-menu-submenu-arrow {
          color: #94a3b8;
        }
        .app-sider.ant-menu-inline-collapsed .ant-menu-item-group-title { display: none !important; }
        /* Left-align items, tight indent (sakai hugs the left edge) */
        .app-sider .ant-menu-item,
        .app-sider .ant-menu-submenu-title {
          text-align: left !important;
          justify-content: flex-start !important;
        }
        .app-sider .ant-menu-title-content { text-align: left !important; }
        .app-sider:not(.ant-menu-inline-collapsed) .ant-menu-submenu-title,
        .app-sider:not(.ant-menu-inline-collapsed) .ant-menu-item {
          padding-left: 16px !important;
          margin-inline: 8px !important;
          width: calc(100% - 16px) !important;
        }
        .app-topbar .ant-typography { line-height: 1; }
      `}</style>

      {/* Brand top bar */}
      <Header
        className="app-topbar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          height: HEADER_H,
          background: 'var(--surface-topbar)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 20,
          borderBottom: '1px solid var(--surface-border-strong)',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobile && (
            <MenuUnfoldOutlined
              style={{ color: 'var(--surface-muted)', fontSize: 18, cursor: 'pointer' }}
              onClick={() => setMobileNavOpen(true)}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={WECARE_LOGO}
            alt="WeCare"
            width={30}
            height={30}
            style={{ display: 'block', borderRadius: 8 }}
          />
          <Typography.Text
            strong
            style={{ color: 'var(--surface-text)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}
          >
            WeCare ERP
          </Typography.Text>
          {/* DEV-ONLY: unmistakable marker when the fake-admin bypass is active. */}
          {AUTH_BYPASS && (
            <span
              title="NEXT_PUBLIC_AUTH_BYPASS=1 — fake admin, no real login. Unset it and restart to test for real."
              style={{
                marginLeft: 4,
                padding: '2px 8px',
                borderRadius: 6,
                background: '#fff7ed',
                color: '#c2410c',
                border: '1px solid #fed7aa',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                lineHeight: 1.4,
              }}
            >
              DEV BYPASS
            </span>
          )}
        </div>

        <Space size={8} align="center">
          <Configurator />
          {userMenu}
        </Space>
      </Header>

      {/* Desktop sidebar (below the top bar); toggle sits at its top */}
      {!isMobile && (
        <Sider
          width={SIDER_W}
          collapsedWidth={SIDER_W_COLLAPSED}
          collapsed={collapsed}
          collapsible
          trigger={null}
          theme="light"
          style={{
            position: 'fixed',
            left: 0,
            top: HEADER_H,
            bottom: 0,
            zIndex: 20,
            background: 'var(--surface-card)',
            overflow: 'auto',
            borderRight: '1px solid var(--surface-border-strong)',
            paddingTop: 8,
          }}
        >
          {/* Collapse/expand toggle — top of the sidebar */}
          <div
            role="button"
            tabIndex={0}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              padding: '0 22px',
              cursor: 'pointer',
              color: 'var(--surface-muted)',
              fontSize: 18,
            }}
            onClick={() => setCollapsed((c) => !c)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setCollapsed((c) => !c);
              }
            }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          {siteMap}
        </Sider>
      )}

      {/* Mobile sidebar Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          width={SIDER_W}
          styles={{ body: { padding: '8px 0' } }}
          closable={false}
        >
          {siteMap}
        </Drawer>
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? SIDER_W_COLLAPSED : SIDER_W,
          marginTop: HEADER_H,
          transition: 'margin-left 0.2s',
        }}
      >
        <Content
          style={{
            margin: 0,
            padding: 24,
            background: 'var(--surface-ground)',
            minHeight: `calc(100vh - ${HEADER_H}px)`,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
