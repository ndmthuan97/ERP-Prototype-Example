'use client';
// =============================================================================
// PHASE 1 — KHÁCH HÀNG: list + search + pagination + create/edit/delete
// =============================================================================

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Popconfirm,
  App,
  Card,
  Row,
  Col,
  Select,
  Tooltip,
} from 'antd';
import type { FormInstance } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  TeamOutlined,
  UserAddOutlined,
  CrownOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { customerApi } from '@/lib/api/customer';
import type { Customer, CreateCustomerInput } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { StatCard } from '@/components/StatCard';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CAN } from '@/lib/auth/permissions';
import { CUSTOMER_STATUS, statusLabel } from '@/lib/constants/status';

const STATUS_COLOR: Record<Customer['status'], string> = {
  prospect: 'default',
  active: 'green',
  suspended: 'orange',
  archived: 'red',
};

export default function CustomersPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const router = useRouter();

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');

  // Create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm<CreateCustomerInput>();

  // Edit modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm] = Form.useForm<CreateCustomerInput>();

  // ---- Queries ----
  const listQuery = useQuery({
    queryKey: ['customers', { q, page, limit, status: statusFilter }],
    queryFn: () => customerApi.list({ q, page, limit, status: statusFilter || undefined }),
  });

  // Fetch a large page for stat calculations (runs once, cached)
  const statsQuery = useQuery({
    queryKey: ['customers', 'stats-all'],
    queryFn: () => customerApi.list({ page: 1, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  // ---- Derived stat values ----
  const stats = useMemo(() => {
    const total = statsQuery.data?.total ?? listQuery.data?.total;
    const customers = statsQuery.data?.data ?? listQuery.data?.data ?? [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const newThisMonth = customers.filter((c) => {
      const d = new Date(c.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    // VIP threshold: credit limit >= 500M VND
    const vipCount = customers.filter(
      (c) =>
        c.creditLimitAmount !== null && c.creditLimitAmount >= 500_000_000,
    ).length;

    // Return rate: active customers / total on current page
    const activeCount = customers.filter((c) => c.status === 'active').length;
    const returnRate =
      customers.length > 0
        ? Math.round((activeCount / customers.length) * 100)
        : 0;

    return {
      total: total ?? '—',
      newThisMonth: String(newThisMonth),
      vipCount: String(vipCount),
      returnRate: `${returnRate}%`,
    };
  }, [statsQuery.data, listQuery.data]);

  // Fetch single customer for edit modal
  const editQuery = useQuery({
    queryKey: ['customers', editingId],
    queryFn: () => customerApi.get(editingId!),
    enabled: !!editingId,
  });

  // ---- Mutations ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleApiError = (err: unknown, form: FormInstance<any>) => {
    if (err instanceof ApiError) {
      const fields = err.fieldErrors();
      const entries = Object.entries(fields);
      if (entries.length) {
        form.setFields(
          entries.map(([name, msg]) => ({ name, errors: [msg] })),
        );
      }
      if (err.isConflict) {
        form.setFields([{ name: 'taxCode', errors: [err.message] }]);
      }
    }
    message.error(toMessage(err));
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateCustomerInput) => customerApi.create(input),
    onSuccess: () => {
      message.success('Customer created');
      setOpenCreate(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => handleApiError(err, createForm),
  });

  const updateMutation = useMutation({
    mutationFn: (input: CreateCustomerInput) =>
      customerApi.update(editingId!, input),
    onSuccess: () => {
      message.success('Customer updated');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => handleApiError(err, editForm),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerApi.remove(id),
    onSuccess: () => {
      message.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  // Prefill edit form when data arrives
  const handleOpenEdit = (record: Customer) => {
    setEditingId(record.id);
    editForm.setFieldsValue({
      businessName: record.businessName,
      taxCode: record.taxCode ?? undefined,
      contactName: record.contactName ?? undefined,
      contactPhone: record.contactPhone ?? undefined,
      contactEmail: record.contactEmail ?? undefined,
      creditLimitAmount: record.creditLimitAmount ?? undefined,
    });
  };

  const columns: ColumnsType<Customer> = [
    {
      title: 'Business Name',
      dataIndex: 'businessName',
      key: 'businessName',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Typography.Link style={{ color: '#1677ff', fontWeight: 500 }}>
          {text}
        </Typography.Link>
      ),
    },
    { title: 'Tax Code', dataIndex: 'taxCode', key: 'taxCode', width: 120, render: (v) => v ?? '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: Customer['status']) => (
        <Tag color={CUSTOMER_STATUS.color[s]}>
          {statusLabel(CUSTOMER_STATUS.label, s)}
        </Tag>
      ),
    },
    {
      title: 'Credit Limit',
      dataIndex: 'creditLimitAmount',
      key: 'creditLimitAmount',
      width: 140,
      align: 'right',
      render: (v: number | null) => formatVnd(v),
    },
    {
      title: 'Used',
      dataIndex: 'creditUsedAmount',
      key: 'creditUsedAmount',
      width: 120,
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Contact',
      key: 'contact',
      width: 150,
      ellipsis: true,
      render: (_, r) => r.contactName ?? r.contactPhone ?? r.contactEmail ?? '—',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Details">
            <Link href={`/customers/${record.id}`}>
              <Button type="link" size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
          {CAN.update(role) && (
            <Tooltip title="Edit">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); handleOpenEdit(record); }}
              />
            </Tooltip>
          )}
          {CAN.delete(role) && (
            <Popconfirm
              title="Delete this customer?"
              description="This will soft-delete the customer."
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Archive">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending && deleteMutation.variables === record.id}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page header */}
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Customers
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpenCreate(true)}
        >
          Create Customer
        </Button>
      </Space>

      {/* Stats row */}
      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<TeamOutlined />}
            iconBgColor="rgba(22, 119, 255, 0.1)"
            iconColor="#1677ff"
            label="Total Customers"
            value={stats.total}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<UserAddOutlined />}
            iconBgColor="rgba(82, 196, 26, 0.1)"
            iconColor="#52c41a"
            label="New This Month"
            value={stats.newThisMonth}
            trend={{ text: '~ estimated from current data', color: 'green' }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CrownOutlined />}
            iconBgColor="rgba(250, 173, 20, 0.1)"
            iconColor="#faad14"
            label="VIP Customers"
            value={stats.vipCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<SyncOutlined />}
            iconBgColor="rgba(114, 46, 209, 0.1)"
            iconColor="#722ed1"
            label="Return Rate"
            value={stats.returnRate}
            trend={{ text: '~ active / total ratio', color: 'green' }}
          />
        </Col>
      </Row>

      {/* Filter bar */}
      <Card
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="Search by business name…"
            style={{ width: 320 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            defaultValue="all"
            style={{ width: 180 }}
            options={[
              { value: '', label: 'All' },
              { value: 'prospect', label: 'Prospect' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'archived', label: 'Archive' },
            ]}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => listQuery.refetch()}
          >
            Reload
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Table<Customer>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.data ?? []}
          loading={listQuery.isFetching}
          scroll={{ x: 1100 }}
          onRow={(record) => ({
            onClick: () => router.push(`/customers/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText: 'No customers yet' }}
          pagination={{
            current: page,
            pageSize: limit,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `${total} customers`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Customer"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
        destroyOnHidden
      >
        <CustomerForm
          form={createForm}
          onSubmit={async (values) => createMutation.mutateAsync(values)}
          loading={createMutation.isPending}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Customer"
        open={!!editingId}
        onCancel={() => setEditingId(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <CustomerForm
          form={editForm}
          onSubmit={async (values) => updateMutation.mutateAsync(values)}
          loading={updateMutation.isPending || editQuery.isLoading}
        />
      </Modal>
    </div>
  );
}
