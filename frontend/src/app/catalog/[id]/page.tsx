'use client';
// =============================================================================
// CATALOG DETAIL PAGE — Product details + edit + activate/deactivate
// =============================================================================

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Card,
  Breadcrumb,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  App,
  Result,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { catalogApi, type Product, type UpdateProductInput } from '@/lib/api/catalog';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatVnd, formatDateTime } from '@/lib/format';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CatalogDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [openEdit, setOpenEdit] = useState(false);
  const [editForm] = Form.useForm<UpdateProductInput>();

  const productQuery = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => catalogApi.get(id),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProductInput) => catalogApi.update(id, data),
    onSuccess: () => {
      message.success('Product updated');
      setOpenEdit(false);
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const activateMutation = useMutation({
    mutationFn: () => catalogApi.activate(id),
    onSuccess: () => {
      message.success('Product activated');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => catalogApi.deactivate(id),
    onSuccess: () => {
      message.success('Product deactivated');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  if (productQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="Loading product…" />
      </div>
    );
  }

  if (productQuery.isError) {
    const is404 =
      productQuery.error instanceof ApiError && productQuery.error.isNotFound;
    return (
      <Result
        status={is404 ? '404' : 'error'}
        title={is404 ? 'Product not found' : 'Failed to load product'}
        subTitle={is404 ? undefined : toMessage(productQuery.error)}
        extra={
          <Link href="/catalog">
            <Button type="primary">Back to Catalog</Button>
          </Link>
        }
      />
    );
  }

  const product = productQuery.data!;

  const handleOpenEdit = () => {
    editForm.setFieldsValue({
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      defaultSalePrice: product.defaultSalePrice,
      taxRate: product.taxRate,
    });
    setOpenEdit(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Breadcrumb
        items={[
          { title: <Link href="/">Home</Link> },
          { title: <Link href="/catalog">Product Catalog</Link> },
          { title: product.name },
        ]}
      />

      <Space align="center" size={12}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {product.name}
        </Typography.Title>
        <Tag color={product.isActive ? 'green' : 'red'}>
          {product.isActive ? 'Active' : 'Inactive'}
        </Tag>
      </Space>

      {/* Fluent / D365 command bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          background: '#fff',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push('/catalog')}>
          Back
        </Button>
        <Button type="text" icon={<EditOutlined />} onClick={handleOpenEdit}>
          Edit
        </Button>
        {product.isActive ? (
          <Button
            type="text"
            danger
            icon={<StopOutlined />}
            loading={deactivateMutation.isPending}
            onClick={() => deactivateMutation.mutate()}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            type="text"
            style={{ color: '#52c41a' }}
            icon={<CheckCircleOutlined />}
            loading={activateMutation.isPending}
            onClick={() => activateMutation.mutate()}
          >
            Activate
          </Button>
        )}
      </div>

      <Card style={{ borderRadius: 4, border: '1px solid #f0f0f0' }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="SKU">
            <Typography.Text keyboard>{product.sku}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Product Name">
            {product.name}
          </Descriptions.Item>
          <Descriptions.Item label="Unit">
            {product.unit}
          </Descriptions.Item>
          <Descriptions.Item label="Default Sale Price">
            <Typography.Text strong>{formatVnd(product.defaultSalePrice)}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tax Rate">
            {`${(product.taxRate * 100).toFixed(0)}%`}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={product.isActive ? 'green' : 'red'}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Version">
            {product.version}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {formatDateTime(product.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {formatDateTime(product.updatedAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Edit Product"
        open={openEdit}
        onCancel={() => setOpenEdit(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateMutation.mutate(values)}
        >
          <Form.Item name="sku" label="SKU" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="defaultSalePrice" label="Default Sale Price" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => Number((v ?? '').replace(/,/g, '')) as 0}
              addonAfter="VNĐ"
            />
          </Form.Item>
          <Form.Item name="taxRate" label="Tax Rate" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 0, label: '0%' },
                { value: 0.05, label: '5%' },
                { value: 0.08, label: '8%' },
                { value: 0.10, label: '10%' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
