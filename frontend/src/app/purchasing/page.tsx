'use client';

import { useState, useMemo, useCallback, type Key } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Typography,
  Tag,
  Card,
  Input,
  Select,
  Tooltip,
  Modal,
  Form,
  Dropdown,
  App,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  DownOutlined,
  MoreOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  TableOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { purchasingApi, type PurchaseOrder } from '@/lib/api/purchasing';
import { supplierApi } from '@/lib/api/supplier';
import type { CreatePurchaseOrderInput } from '@/lib/api/types';
import { formatVnd, formatDateTime } from '@/lib/format';
import { toMessage } from '@/lib/api/errors';
import { CommandBar } from '@/components/d365/CommandBar';

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  placed: 'processing',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
};

export default function PurchasingPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [form] = Form.useForm<CreatePurchaseOrderInput>();

  // D365 view-picker: the "view" is just the status filter presented as named
  // views (All / Draft / Placed / …), matching Power Apps' view selector.
  const VIEWS: { key: string; label: string; value: string }[] = [
    { key: 'all', label: 'All Purchase Orders', value: '' },
    { key: 'draft', label: 'Draft', value: 'draft' },
    { key: 'placed', label: 'Placed', value: 'placed' },
    { key: 'partially_received', label: 'Partially Received', value: 'partially_received' },
    { key: 'received', label: 'Received', value: 'received' },
    { key: 'cancelled', label: 'Cancelled', value: 'cancelled' },
  ];
  const currentView = VIEWS.find((v) => v.value === status) ?? VIEWS[0];

  const listQuery = useQuery({
    queryKey: ['purchasing', 'orders', { page, limit, q, status }],
    queryFn: () => purchasingApi.list({ page, limit, q: q || undefined, status: status || undefined }),
  });

  // Fetch suppliers for name display + create modal
  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => supplierApi.list({ limit: 200 }),
  });

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of suppliersQuery.data?.data ?? []) {
      map.set(s.id, s.name);
    }
    return map;
  }, [suppliersQuery.data]);

  const ordersData = listQuery.data?.data ?? [];
  const totalCount = listQuery.data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (input: CreatePurchaseOrderInput) => purchasingApi.create(input),
    onSuccess: (data) => {
      message.success('Purchase order created');
      setOpenCreate(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['purchasing'] });
      router.push(`/purchasing/${data.id}`);
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQ(value);
    setPage(1);
  }, []);

  const columns: ColumnsType<PurchaseOrder> = [
    {
      title: 'PO ID',
      dataIndex: 'id',
      key: 'id',
      sorter: (a, b) => a.id.localeCompare(b.id),
      render: (id: string, record) => (
        <Typography.Link
          strong
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/purchasing/${record.id}`);
          }}
        >
          {id.slice(0, 8)}…
        </Typography.Link>
      ),
    },
    {
      title: 'Suppliers',
      dataIndex: 'supplierId',
      key: 'supplierId',
      render: (id: string) => supplierMap.get(id) ?? id.slice(0, 8) + '…',
    },
    {
      title: 'Lines',
      dataIndex: 'lineCount',
      key: 'lineCount',
      align: 'center',
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalCost',
      key: 'totalCost',
      align: 'right',
      sorter: (a, b) => a.totalCost - b.totalCost,
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '',
      key: 'actions',
      align: 'center',
      width: 60,
      render: (_, record) => (
        <Tooltip title="Details">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/purchasing/${record.id}`);
            }}
          />
        </Tooltip>
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
              handleStatusChange(next?.value ?? '');
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
          onSearch={handleSearch}
        />
      </CommandBar>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}
      >
        <Table<PurchaseOrder>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={ordersData}
          loading={listQuery.isFetching}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          onRow={(record) => ({
            onClick: () => router.push(`/purchasing/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          pagination={{
            current: page,
            pageSize: limit,
            total: totalCount,
            showSizeChanger: true,
            showTotal: (total) => `Rows: ${total}`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      {/* Create PO Modal */}
      <Modal
        title="Create purchase order"
        open={openCreate}
        onCancel={() => { setOpenCreate(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            label="Suppliers"
            name="supplierId"
            rules={[{ required: true, message: 'Select supplier' }]}
          >
            <Select
              showSearch
              filterOption={(input, option) =>
                (option?.label?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
              }
              placeholder="Select supplier..."
              loading={suppliersQuery.isFetching}
              options={(suppliersQuery.data?.data ?? [])
                .filter((s) => s.isActive)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
