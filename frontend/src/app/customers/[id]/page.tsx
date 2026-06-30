'use client';
// Customer detail page — Descriptions + Credit Check card + Edit/Delete actions

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Descriptions,
  Tag,
  Space,
  Button,
  Spin,
  Modal,
  Form,
  Card,
  Statistic,
  Badge,
  Breadcrumb,
  Popconfirm,
  App,
  Result,
  Table,
  Empty,
  Typography,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { customerApi } from '@/lib/api/customer';
import { salesApi } from '@/lib/api/sales';
import type { CreateCustomerInput, Customer } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { ORDER_STATUS } from '@/lib/constants/status';

const STATUS_COLOR: Record<Customer['status'], string> = {
  prospect: 'default',
  active: 'green',
  suspended: 'orange',
  archived: 'red',
};

const STATUS_LABEL: Record<Customer['status'], string> = {
  prospect: 'Prospect',
  active: 'Active',
  suspended: 'Suspended',
  archived: 'Archive',
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [openEdit, setOpenEdit] = useState(false);
  const [editForm] = Form.useForm<CreateCustomerInput>();

  const id = params.id;

  const customerQuery = useQuery({
    queryKey: ['customers', id],
    queryFn: () => customerApi.get(id),
  });

  const creditQuery = useQuery({
    queryKey: ['customers', id, 'credit-check'],
    queryFn: () => customerApi.creditCheck(id),
    enabled: !!customerQuery.data,
  });

  // Order history for this customer
  const ordersQuery = useQuery({
    queryKey: ['orders', 'by-customer', id],
    queryFn: () => salesApi.list({ limit: 50 }),
    enabled: !!customerQuery.data,
  });

  const updateMutation = useMutation({
    mutationFn: (input: CreateCustomerInput) => customerApi.update(id, input),
    onSuccess: () => {
      message.success('Customer updated');
      setOpenEdit(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors();
        const entries = Object.entries(fields);
        if (entries.length) {
          editForm.setFields(
            entries.map(([name, msg]) => ({ name: name as keyof CreateCustomerInput, errors: [msg] })),
          );
        }
        if (err.isConflict) {
          editForm.setFields([{ name: 'taxCode' as const, errors: [err.message] }]);
        }
      }
      message.error(toMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => customerApi.remove(id),
    onSuccess: () => {
      message.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push('/customers');
    },
    onError: (err) => message.error(toMessage(err)),
  });

  // Loading state
  if (customerQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  // Error / not found
  if (customerQuery.isError) {
    const is404 =
      customerQuery.error instanceof ApiError &&
      customerQuery.error.isNotFound;
    return (
      <Result
        status={is404 ? '404' : 'error'}
        title={is404 ? 'Customer not found' : 'Failed to load data'}
        subTitle={is404 ? undefined : toMessage(customerQuery.error)}
        extra={
          <Link href="/customers">
            <Button type="primary">Back to list</Button>
          </Link>
        }
      />
    );
  }

  const customer = customerQuery.data!;
  const credit = creditQuery.data;

  // Bug M9: available=0 && canOrder=true means unlimited credit
  const isUnlimited = credit
    ? credit.available === 0 && credit.canOrder === true
    : false;

  const handleOpenEdit = () => {
    editForm.setFieldsValue({
      businessName: customer.businessName,
      taxCode: customer.taxCode ?? undefined,
      contactName: customer.contactName ?? undefined,
      contactPhone: customer.contactPhone ?? undefined,
      contactEmail: customer.contactEmail ?? undefined,
      creditLimitAmount: customer.creditLimitAmount ?? undefined,
    });
    setOpenEdit(true);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Breadcrumb
        items={[
          { title: <Link href="/">Dashboard</Link> },
          { title: <Link href="/customers">Customers</Link> },
          { title: customer.businessName },
        ]}
      />

      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/customers')}
        >
          Back
        </Button>
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleOpenEdit}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this customer?"
            description="This will soft-delete the customer."
            onConfirm={() => deleteMutation.mutate()}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      </Space>

      <Descriptions
        title="Customer Information"
        bordered
        column={{ xs: 1, sm: 2 }}
      >
        <Descriptions.Item label="Business Name">
          {customer.businessName}
        </Descriptions.Item>
        <Descriptions.Item label="Tax Code">
          {customer.taxCode ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={STATUS_COLOR[customer.status]}>
            {STATUS_LABEL[customer.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Contact Person">
          {customer.contactName ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Phone">
          {customer.contactPhone ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Email">
          {customer.contactEmail ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Credit Limit">
          {formatVnd(customer.creditLimitAmount)}
        </Descriptions.Item>
        <Descriptions.Item label="Used">
          {formatVnd(customer.creditUsedAmount)}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {formatDateTime(customer.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Last Updated">
          {formatDateTime(customer.updatedAt)}
        </Descriptions.Item>
      </Descriptions>

      {/* Credit Check Card */}
      <Card
        title="Credit Check"
        loading={creditQuery.isLoading}
        extra={
          credit && (
            <Badge
              status={credit.canOrder ? 'success' : 'error'}
              text={credit.canOrder ? 'Can Order' : 'Cannot Order'}
            />
          )
        }
      >
        {credit && (
          <Space size="large" wrap>
            <Statistic
              title="Credit Limit"
              value={
                credit.creditLimit === null
                  ? 'Unlimited'
                  : formatVnd(credit.creditLimit)
              }
            />
            <Statistic
              title="Used"
              value={formatVnd(credit.creditUsed)}
            />
            <Statistic
              title="Available"
              value={isUnlimited ? 'Unlimited' : formatVnd(credit.available)}
            />
            <Statistic
              title="Can Order"
              value={credit.canOrder ? 'Yes' : 'No'}
              valueStyle={{ color: credit.canOrder ? '#52c41a' : '#ff4d4f' }}
            />
          </Space>
        )}
        {creditQuery.isError && (
          <Result
            status="error"
            title="Credit check unavailable"
            subTitle={toMessage(creditQuery.error)}
          />
        )}
      </Card>

      {/* Order History */}
      <Card
        title={
          <Space>
            <ShoppingCartOutlined />
            Order History
          </Space>
        }
        loading={ordersQuery.isLoading}
      >
        {ordersQuery.data?.data && ordersQuery.data.data.length > 0 ? (
          <Table
            rowKey="id"
            size="small"
            dataSource={
              ordersQuery.data.data.filter((o) => o.customerId === id)
            }
            pagination={{ pageSize: 5 }}
            onRow={(record) => ({
              onClick: () => router.push(`/orders/${record.id}`),
              style: { cursor: 'pointer' },
            })}
            columns={[
              {
                title: 'Order ID',
                dataIndex: 'id',
                render: (v: string) => (
                  <Typography.Link>{v.slice(0, 8)}…</Typography.Link>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (s: string) => (
                  <Tag color={ORDER_STATUS.color[s] ?? 'default'}>
                    {ORDER_STATUS.label[s] ?? s}
                  </Tag>
                ),
              },
              {
                title: 'Total',
                dataIndex: 'totalAmount',
                align: 'right',
                render: (v: number) => formatVnd(v),
              },
              {
                title: 'Created',
                dataIndex: 'createdAt',
                render: (v: string) => formatDateTime(v),
              },
            ]}
          />
        ) : (
          <Empty description="No orders found for this customer" />
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Edit Customer"
        open={openEdit}
        onCancel={() => setOpenEdit(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <CustomerForm
          form={editForm}
          initialValues={{
            businessName: customer.businessName,
            taxCode: customer.taxCode ?? undefined,
            contactName: customer.contactName ?? undefined,
            contactPhone: customer.contactPhone ?? undefined,
            contactEmail: customer.contactEmail ?? undefined,
            creditLimitAmount: customer.creditLimitAmount ?? undefined,
          }}
          onSubmit={async (values) => { await updateMutation.mutateAsync(values); }}
          loading={updateMutation.isPending}
        />
      </Modal>
    </Space>
  );
}
