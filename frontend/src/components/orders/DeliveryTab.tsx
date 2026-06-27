'use client';
// =============================================================================
// DELIVERY TAB — List + manage delivery orders for a sales order
// =============================================================================

import { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  InputNumber,
  Steps,
  App,
  Card,
  Empty,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  CarOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { deliveryApi } from '@/lib/api/sales';
import type {
  DeliveryOrder,
  DeliveryLine,
  DeliveryStatus,
  SalesOrderLine,
  CreateDeliveryInput,
} from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  draft: 'default',
  picking: 'processing',
  packed: 'warning',
  shipped: 'blue',
  delivered: 'success',
  failed: 'error',
};

const STEP_MAP: Record<DeliveryStatus, number> = {
  draft: 0,
  picking: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
  failed: -1,
};

interface Props {
  orderId: string;
  orderLines: SalesOrderLine[];
  orderStatus: string;
}

export function DeliveryTab({ orderId, orderLines, orderStatus }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [expandedDO, setExpandedDO] = useState<string | null>(null);

  const deliveriesQuery = useQuery({
    queryKey: ['orders', orderId, 'deliveries'],
    queryFn: () => deliveryApi.list(orderId),
  });

  const deliveries = deliveriesQuery.data ?? [];
  const canCreate = orderStatus === 'confirmed' || orderStatus === 'partially_delivered';

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (input: CreateDeliveryInput) => deliveryApi.create(orderId, input),
    onSuccess: () => {
      message.success('Đã tạo phiếu giao hàng');
      setOpenCreate(false);
      queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const actionMutation = useMutation({
    mutationFn: ({ doId, action }: { doId: string; action: string }) => {
      const actions: Record<string, (oid: string, did: string) => Promise<DeliveryOrder>> = {
        start_picking: deliveryApi.startPicking,
        pack: deliveryApi.pack,
        ship: deliveryApi.ship,
        deliver: deliveryApi.deliver,
      };
      return actions[action](orderId, doId);
    },
    onSuccess: () => {
      message.success('Cập nhật thành công');
      queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['orders', orderId] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const getNextAction = (status: DeliveryStatus): { label: string; action: string } | null => {
    const map: Record<string, { label: string; action: string }> = {
      draft: { label: 'Bắt đầu lấy hàng', action: 'start_picking' },
      picking: { label: 'Đóng gói', action: 'pack' },
      packed: { label: 'Vận chuyển', action: 'ship' },
      shipped: { label: 'Đã giao', action: 'deliver' },
    };
    return map[status] ?? null;
  };

  const columns: ColumnsType<DeliveryOrder> = [
    {
      title: 'Mã phiếu',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Typography.Text
          style={{ cursor: 'pointer', fontWeight: 500, color: '#1677ff' }}
          onClick={() => setExpandedDO(expandedDO === id ? null : id)}
        >
          {id.slice(0, 8)}…
        </Typography.Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (s: DeliveryStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    },
    {
      title: 'Số dòng',
      key: 'lineCount',
      align: 'center',
      render: (_, record) => record.lines?.length ?? 0,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Hành động',
      key: 'actions',
      align: 'center',
      render: (_, record) => {
        const next = getNextAction(record.status);
        if (!next) return null;
        return (
          <Button
            size="small"
            type="primary"
            loading={actionMutation.isPending}
            onClick={() => actionMutation.mutate({ doId: record.id, action: next.action })}
          >
            {next.label}
          </Button>
        );
      },
    },
  ];

  // ---- Create form ----

  const handleCreate = (values: Record<string, number>) => {
    const lines = orderLines
      .map((line) => ({
        salesOrderLineId: line.id,
        itemId: line.itemId,
        itemName: line.itemName,
        quantity: values[`qty_${line.id}`] ?? 0,
      }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      message.warning('Chọn ít nhất 1 dòng hàng');
      return;
    }

    createMutation.mutate({ lines });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text strong>Phiếu giao hàng ({deliveries.length})</Typography.Text>
        {canCreate && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setOpenCreate(true)}
          >
            Tạo phiếu giao
          </Button>
        )}
      </div>

      {deliveries.length === 0 ? (
        <Empty description="Chưa có phiếu giao hàng nào" />
      ) : (
        <>
          <Table<DeliveryOrder>
            rowKey="id"
            columns={columns}
            dataSource={deliveries}
            pagination={false}
            size="small"
          />

          {/* Expanded DO detail */}
          {expandedDO && (() => {
            const doItem = deliveries.find((d) => d.id === expandedDO);
            if (!doItem) return null;
            return (
              <Card size="small" title={`Chi tiết: ${expandedDO.slice(0, 8)}…`}>
                <Steps
                  current={STEP_MAP[doItem.status] ?? 0}
                  size="small"
                  items={[
                    { title: 'Nháp', icon: <ClockCircleOutlined /> },
                    { title: 'Lấy hàng', icon: <InboxOutlined /> },
                    { title: 'Đóng gói', icon: <InboxOutlined /> },
                    { title: 'Vận chuyển', icon: <CarOutlined /> },
                    { title: 'Đã giao', icon: <CheckCircleOutlined /> },
                  ]}
                  style={{ marginBottom: 16 }}
                />
                <Table<DeliveryLine>
                  rowKey="id"
                  dataSource={doItem.lines ?? []}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Sản phẩm', dataIndex: 'itemName', key: 'itemName' },
                    { title: 'SL giao', dataIndex: 'quantity', key: 'quantity', align: 'center' },
                  ]}
                />
                {doItem.failReason && (
                  <Typography.Text type="danger" style={{ marginTop: 8, display: 'block' }}>
                    Lý do thất bại: {doItem.failReason}
                  </Typography.Text>
                )}
              </Card>
            );
          })()}
        </>
      )}

      {/* Create Delivery Modal */}
      <Modal
        title="Tạo phiếu giao hàng"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={() => {
          const formEl = document.getElementById('delivery-create-form') as HTMLFormElement;
          formEl?.requestSubmit();
        }}
        confirmLoading={createMutation.isPending}
        okText="Tạo"
        cancelText="Hủy"
      >
        <Typography.Paragraph type="secondary">
          Nhập số lượng giao cho mỗi dòng hàng. Để trống hoặc 0 để bỏ qua.
        </Typography.Paragraph>
        <form
          id="delivery-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const values: Record<string, number> = {};
            for (const [key, val] of formData.entries()) {
              values[key] = Number(val) || 0;
            }
            handleCreate(values);
          }}
        >
          <Table
            rowKey="id"
            dataSource={orderLines}
            pagination={false}
            size="small"
            columns={[
              { title: 'Sản phẩm', dataIndex: 'itemName', key: 'itemName' },
              { title: 'SL đơn', dataIndex: 'quantity', key: 'quantity', align: 'center' },
              {
                title: 'SL giao',
                key: 'deliverQty',
                align: 'center',
                render: (_, record: SalesOrderLine) => (
                  <input
                    name={`qty_${record.id}`}
                    type="number"
                    min={0}
                    max={record.quantity}
                    defaultValue={record.quantity}
                    style={{
                      width: 80,
                      textAlign: 'center',
                      border: '1px solid #d9d9d9',
                      borderRadius: 6,
                      padding: '4px 8px',
                    }}
                  />
                ),
              },
            ]}
          />
        </form>
      </Modal>
    </div>
  );
}
