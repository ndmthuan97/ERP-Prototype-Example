'use client';
// =============================================================================
// RETURN TAB — List + manage sales returns for a sales order
// =============================================================================

import { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  App,
  Empty,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { returnApi } from '@/lib/api/sales';
import type {
  SalesReturn,
  SalesReturnStatus,
  SalesOrderLine,
  CreateReturnInput,
} from '@/lib/api/types';
import { toMessage } from '@/lib/api/errors';
import { formatDateTime, formatVnd } from '@/lib/format';

const STATUS_COLOR: Record<SalesReturnStatus, string> = {
  draft: 'default',
  approved: 'processing',
  goods_received: 'warning',
  completed: 'success',
  rejected: 'error',
};

const STATUS_LABEL: Record<SalesReturnStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  goods_received: 'Goods Received',
  completed: 'Complete',
  rejected: 'Reject',
};

interface Props {
  orderId: string;
  orderLines: SalesOrderLine[];
  orderStatus: string;
}

export function ReturnTab({ orderId, orderLines, orderStatus }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [form] = Form.useForm();

  const returnsQuery = useQuery({
    queryKey: ['orders', orderId, 'returns'],
    queryFn: () => returnApi.list(orderId),
  });

  const returns = returnsQuery.data ?? [];
  const canCreate =
    orderStatus === 'partially_delivered' || orderStatus === 'fully_delivered';

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (input: CreateReturnInput) => returnApi.create(orderId, input),
    onSuccess: () => {
      message.success('Return order created');
      setOpenCreate(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'returns'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const actionMutation = useMutation({
    mutationFn: ({ returnId, action }: { returnId: string; action: string }) => {
      const actions: Record<string, (oid: string, rid: string) => Promise<SalesReturn>> = {
        approve: returnApi.approve,
        reject: returnApi.reject,
        receive_goods: returnApi.receiveGoods,
        complete: returnApi.complete,
      };
      return actions[action](orderId, returnId);
    },
    onSuccess: () => {
      message.success('Updated successfully');
      queryClient.invalidateQueries({ queryKey: ['orders', orderId, 'returns'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const getActions = (ret: SalesReturn) => {
    const btns: { label: string; action: string; danger?: boolean }[] = [];
    switch (ret.status) {
      case 'draft':
        btns.push({ label: 'Approve', action: 'approve' });
        btns.push({ label: 'Reject', action: 'reject', danger: true });
        break;
      case 'approved':
        btns.push({ label: 'Receive Goods', action: 'receive_goods' });
        break;
      case 'goods_received':
        btns.push({ label: 'Complete', action: 'complete' });
        break;
    }
    return btns;
  };

  const columns: ColumnsType<SalesReturn> = [
    {
      title: 'DO ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Typography.Text>{id.slice(0, 8)}…</Typography.Text>,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: SalesReturnStatus) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Tag>
      ),
    },
    {
      title: 'Refund',
      dataIndex: 'totalRefundAmount',
      key: 'totalRefundAmount',
      align: 'right',
      render: (v: number) => formatVnd(v),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => {
        const actions = getActions(record);
        if (actions.length === 0) return null;
        return (
          <Space size="small">
            {actions.map((a) => (
              <Button
                key={a.action}
                size="small"
                type={a.danger ? 'default' : 'primary'}
                danger={a.danger}
                loading={actionMutation.isPending}
                onClick={() =>
                  actionMutation.mutate({ returnId: record.id, action: a.action })
                }
              >
                {a.label}
              </Button>
            ))}
          </Space>
        );
      },
    },
  ];

  // ---- Create handler ----

  const handleCreate = (values: { reason: string; [key: string]: unknown }) => {
    const lines = orderLines
      .map((line) => ({
        salesOrderLineId: line.id,
        itemId: line.itemId,
        itemName: line.itemName,
        quantity: Number(values[`qty_${line.id}`]) || 0,
        unitPrice: line.unitPrice,
        reason: values[`reason_${line.id}`] as string | undefined,
      }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      message.warning('Select at least 1 line item');
      return;
    }

    createMutation.mutate({ reason: values.reason, lines });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text strong>Return Orders ({returns.length})</Typography.Text>
        {canCreate && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setOpenCreate(true)}
          >
            Create Return
          </Button>
        )}
      </div>

      {returns.length === 0 ? (
        <Empty description="No return orders yet" />
      ) : (
        <Table<SalesReturn>
          rowKey="id"
          columns={columns}
          dataSource={returns}
          pagination={false}
          size="small"
        />
      )}

      {/* Create Return Modal */}
      <Modal
        title="Create Return Order"
        open={openCreate}
        onCancel={() => {
          setOpenCreate(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
        cancelText="Cancel"
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="Return Reason"
            name="reason"
            rules={[{ required: true, message: 'Enter reason' }]}
          >
            <Input.TextArea rows={2} placeholder="e.g. Defective, wrong model..." />
          </Form.Item>

          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Select lines to return (enter qty {'>'} 0):
          </Typography.Text>

          <Table
            rowKey="id"
            dataSource={orderLines}
            pagination={false}
            size="small"
            columns={[
              { title: 'Products', dataIndex: 'itemName', key: 'itemName' },
              {
                title: 'Order Qty',
                dataIndex: 'quantity',
                key: 'quantity',
                align: 'center',
              },
              {
                title: 'Return Qty',
                key: 'returnQty',
                align: 'center',
                render: (_: unknown, record: SalesOrderLine) => (
                  <Form.Item name={`qty_${record.id}`} noStyle>
                    <InputNumber<number>
                      min={0}
                      max={record.quantity}
                      style={{ width: 80 }}
                      placeholder="0"
                    />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </div>
  );
}
