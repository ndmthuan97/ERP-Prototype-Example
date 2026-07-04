'use client';

import { useState } from 'react';
import {
  Table,
  Input,
  Button,
  Typography,
  Tag,
  Modal,
  Form,
  Card,
  Select,
  App,
  Result,
  Space,
  Tooltip,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import {
  authAdminApi,
  type UserListItem,
  type RegisterInput,
} from '@/lib/api/authAdmin';
import { formatDateTime } from '@/lib/format';
import { toMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CommandBar } from '@/components/d365/CommandBar';

// D365 role chips — tinted so admins/managers stand out from staff.
const ROLE_COLORS: Record<string, string> = {
  admin: 'geekblue',
  manager: 'cyan',
  staff: 'default',
  viewer: 'default',
};

export default function UsersPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm();

  // Row currently being edited in the "Edit role" modal (null = closed).
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editForm] = Form.useForm();

  const isAdmin = user?.role === 'admin';

  const listQuery = useQuery({
    queryKey: ['users', { q, page, limit }],
    queryFn: () => authAdminApi.listUsers({ q, page, limit }),
    // Never fire the admin-only endpoint for non-admins (avoids a guaranteed 403).
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: RegisterInput) => authAdminApi.register(data),
    onSuccess: () => {
      message.success('User created');
      setOpenCreate(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  // Single mutation drives both actions — change role (from the modal) and the
  // activate/deactivate toggle — since they hit the same PATCH endpoint.
  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      body: { role?: string; isActive?: boolean };
    }) => authAdminApi.updateUser(vars.id, vars.body),
    onSuccess: () => {
      message.success('User updated');
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const columns: ColumnsType<UserListItem> = [
    {
      title: 'Full name',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 220,
      sorter: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 260,
      sorter: (a, b) => a.email.localeCompare(b.email),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role] ?? 'default'}>{role}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_: unknown, record: UserListItem) => {
        // Mirror the backend self-lockout guard: admins can't edit their own
        // role or deactivate themselves, so disable those actions on their row.
        const isSelf = record.id === user?.id;
        return (
          <Space size={4}>
            <Tooltip title="Edit role">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                disabled={isSelf}
                onClick={() => setEditingUser(record)}
              />
            </Tooltip>
            {record.isActive ? (
              <Popconfirm
                title="Deactivate user"
                description={`Deactivate ${record.fullName}?`}
                okText="Deactivate"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                disabled={isSelf}
                onConfirm={() =>
                  updateMutation.mutate({
                    id: record.id,
                    body: { isActive: false },
                  })
                }
              >
                <Tooltip title="Deactivate">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<StopOutlined />}
                    disabled={isSelf}
                  />
                </Tooltip>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="Activate user"
                description={`Activate ${record.fullName}?`}
                okText="Activate"
                cancelText="Cancel"
                onConfirm={() =>
                  updateMutation.mutate({
                    id: record.id,
                    body: { isActive: true },
                  })
                }
              >
                <Tooltip title="Activate">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckCircleOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // Admin gate — all hooks above run unconditionally (Rules of Hooks).
  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="Admins only"
        subTitle="You do not have permission to manage users."
      />
    );
  }

  // Search runs server-side: `q` is part of the query key and sent to the API,
  // so the rows returned are already filtered + paginated by the backend.
  const rows = listQuery.data?.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Users
        </Typography.Title>
      </div>

      {/* D365 command bar */}
      <CommandBar>
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={() => setOpenCreate(true)}
        >
          New
        </Button>
        <Button
          type="text"
          icon={<ReloadOutlined />}
          loading={listQuery.isFetching}
          onClick={() => listQuery.refetch()}
        >
          Refresh
        </Button>

        <div style={{ flex: 1 }} />

        <Input.Search
          allowClear
          placeholder="Filter by keyword"
          style={{ width: 240 }}
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
      </CommandBar>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<UserListItem>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isFetching}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: limit,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `Rows: ${total}`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      <Modal
        title="New user"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values: RegisterInput) => createMutation.mutateAsync(values)}
        >
          <Form.Item
            name="fullName"
            label="Full name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="Enter full name..." />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Invalid email format' },
            ]}
          >
            <Input placeholder="name@company.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter a password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password placeholder="At least 6 characters" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Role"
            initialValue="staff"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'manager', label: 'Manager' },
                { value: 'staff', label: 'Staff' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit role — remounts on each open (destroyOnHidden), so initialValues
          reflect the row being edited. */}
      <Modal
        title={
          editingUser ? `Edit role — ${editingUser.fullName}` : 'Edit role'
        }
        open={!!editingUser}
        onCancel={() => setEditingUser(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={{ role: editingUser?.role }}
          onFinish={(values: { role: string }) => {
            if (!editingUser) return;
            updateMutation.mutate({
              id: editingUser.id,
              body: { role: values.role },
            });
          }}
        >
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select
              options={[
                { value: 'admin', label: 'Admin' },
                { value: 'manager', label: 'Manager' },
                { value: 'staff', label: 'Staff' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
