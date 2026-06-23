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
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { customerApi } from '@/lib/api/customer';
import type { CreateCustomerInput, Customer } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth/AuthProvider';
import { CustomerForm } from '@/components/customers/CustomerForm';

const STATUS_COLOR: Record<Customer['status'], string> = {
  prospect: 'default',
  active: 'green',
  suspended: 'orange',
  archived: 'red',
};

const STATUS_LABEL: Record<Customer['status'], string> = {
  prospect: 'Tiềm năng',
  active: 'Hoạt động',
  suspended: 'Tạm ngưng',
  archived: 'Lưu trữ',
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

  const updateMutation = useMutation({
    mutationFn: (input: CreateCustomerInput) => customerApi.update(id, input),
    onSuccess: () => {
      message.success('Đã cập nhật khách hàng');
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
      message.success('Đã xóa khách hàng');
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
        title={is404 ? 'Không tìm thấy khách hàng' : 'Lỗi tải dữ liệu'}
        subTitle={is404 ? undefined : toMessage(customerQuery.error)}
        extra={
          <Link href="/customers">
            <Button type="primary">Quay lại danh sách</Button>
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
          { title: <Link href="/">Tổng quan</Link> },
          { title: <Link href="/customers">Khách hàng</Link> },
          { title: customer.businessName },
        ]}
      />

      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/customers')}
        >
          Quay lại
        </Button>
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleOpenEdit}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xác nhận xóa khách hàng?"
            description="Thao tác này sẽ xóa mềm khách hàng."
            onConfirm={() => deleteMutation.mutate()}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending}
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      </Space>

      <Descriptions
        title="Thông tin khách hàng"
        bordered
        column={{ xs: 1, sm: 2 }}
      >
        <Descriptions.Item label="Tên doanh nghiệp">
          {customer.businessName}
        </Descriptions.Item>
        <Descriptions.Item label="Mã số thuế">
          {customer.taxCode ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <Tag color={STATUS_COLOR[customer.status]}>
            {STATUS_LABEL[customer.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Người liên hệ">
          {customer.contactName ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Điện thoại">
          {customer.contactPhone ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Email">
          {customer.contactEmail ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Hạn mức tín dụng">
          {formatVnd(customer.creditLimitAmount)}
        </Descriptions.Item>
        <Descriptions.Item label="Đã sử dụng">
          {formatVnd(customer.creditUsedAmount)}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">
          {formatDateTime(customer.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Cập nhật lần cuối">
          {formatDateTime(customer.updatedAt)}
        </Descriptions.Item>
      </Descriptions>

      {/* Credit Check Card */}
      <Card
        title="Kiểm tra tín dụng"
        loading={creditQuery.isLoading}
        extra={
          credit && (
            <Badge
              status={credit.canOrder ? 'success' : 'error'}
              text={credit.canOrder ? 'Được đặt hàng' : 'Không được đặt hàng'}
            />
          )
        }
      >
        {credit && (
          <Space size="large" wrap>
            <Statistic
              title="Hạn mức"
              value={
                credit.creditLimit === null
                  ? 'Không giới hạn'
                  : formatVnd(credit.creditLimit)
              }
            />
            <Statistic
              title="Đã sử dụng"
              value={formatVnd(credit.creditUsed)}
            />
            <Statistic
              title="Khả dụng"
              value={isUnlimited ? 'Không giới hạn' : formatVnd(credit.available)}
            />
            <Statistic
              title="Được đặt hàng"
              value={credit.canOrder ? 'Có' : 'Không'}
              valueStyle={{ color: credit.canOrder ? '#52c41a' : '#ff4d4f' }}
            />
          </Space>
        )}
        {creditQuery.isError && (
          <Result
            status="error"
            title="Không thể kiểm tra tín dụng"
            subTitle={toMessage(creditQuery.error)}
          />
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Sửa khách hàng"
        open={openEdit}
        onCancel={() => setOpenEdit(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Lưu"
        cancelText="Hủy"
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
