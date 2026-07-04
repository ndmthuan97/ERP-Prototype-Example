'use client';
// =============================================================================
// PHASE 1 — KHÁCH HÀNG: list + search + pagination + create/edit/delete
// =============================================================================

import { useState, type Key } from 'react';
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
  Tooltip,
  Dropdown,
} from 'antd';
import type { FormInstance } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownOutlined,
  MoreOutlined,
  FileExcelOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { customerApi } from '@/lib/api/customer';
import type { Customer, CreateCustomerInput } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CAN } from '@/lib/auth/permissions';
import { CUSTOMER_STATUS, statusLabel } from '@/lib/constants/status';
import { CommandBar } from '@/components/d365/CommandBar';

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  // D365 view-picker: the customer status filter presented as named views,
  // matching the Power Apps view selector.
  const VIEWS: { key: string; label: string; value: string }[] = [
    { key: 'all', label: 'All Customers', value: '' },
    { key: 'prospect', label: 'Prospect', value: 'prospect' },
    { key: 'active', label: 'Active', value: 'active' },
    { key: 'suspended', label: 'Suspended', value: 'suspended' },
    { key: 'archived', label: 'Archived', value: 'archived' },
  ];
  const currentView = VIEWS.find((v) => v.value === statusFilter) ?? VIEWS[0];

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

  // Fetch single customer for edit modal
  const editQuery = useQuery({
    queryKey: ['customers', editingId],
    queryFn: () => customerApi.get(editingId!),
    enabled: !!editingId,
  });

  // ---- Mutations ----
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
      sorter: (a, b) => a.businessName.localeCompare(b.businessName),
      render: (text: string, record) => (
        <Typography.Link
          strong
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/customers/${record.id}`);
          }}
        >
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
      sorter: (a, b) => (a.creditLimitAmount ?? 0) - (b.creditLimitAmount ?? 0),
      render: (v: number | null) => formatVnd(v),
    },
    {
      title: 'Used',
      dataIndex: 'creditUsedAmount',
      key: 'creditUsedAmount',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.creditUsedAmount - b.creditUsedAmount,
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
              <Button type="text" size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>
          {CAN.update(role) && (
            <Tooltip title="Edit">
              <Button
                type="text"
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
                  type="text"
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* D365 view-picker: selectable view name is the page header */}
      <div>
        <Dropdown
          trigger={['click']}
          menu={{
            selectable: true,
            selectedKeys: [currentView.key],
            items: VIEWS.map((v) => ({ key: v.key, label: v.label })),
            onClick: ({ key }) => {
              const next = VIEWS.find((v) => v.key === key);
              setStatusFilter(next?.value ?? '');
              setPage(1);
            },
          }}
        >
          <a
            role="button"
            tabIndex={0}
            onClick={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (e.currentTarget as HTMLElement).click();
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--surface-text)' }}
          >
            <Typography.Title level={4} style={{ margin: 0 }}>
              {currentView.label}
            </Typography.Title>
            <DownOutlined style={{ fontSize: 12, color: '#8A8886' }} />
          </a>
        </Dropdown>
      </div>

      {/* D365 command bar */}
      <CommandBar>
        <Button type="text" icon={<PlusOutlined />} onClick={() => setOpenCreate(true)}>
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
        <Button
          type="text"
          icon={<DeleteOutlined />}
          disabled={selectedRowKeys.length === 0}
        >
          Delete{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
        </Button>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'excel', icon: <FileExcelOutlined />, label: 'Export to Excel', disabled: true },
              { key: 'columns', icon: <TableOutlined />, label: 'Edit columns', disabled: true },
            ],
          }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label="More commands" />
        </Dropdown>

        <div style={{ flex: 1 }} />

        <Input.Search
          allowClear
          aria-label="Filter by keyword"
          placeholder="Filter by keyword"
          style={{ width: 240 }}
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
      </CommandBar>

      {/* Table */}
      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<Customer>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={listQuery.data?.data ?? []}
          loading={listQuery.isFetching}
          scroll={{ x: 1100 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
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
            showTotal: (total) => `Rows: ${total}`,
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
