'use client';
// =============================================================================
// PHASE 2 — TỒN KHO CHI TIẾT: xem item + nhập kho + kiểm tra tồn
// =============================================================================

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  Input,
  InputNumber,
  Button,
  Space,
  Statistic,
  Badge,
  Row,
  Col,
  Spin,
  Alert,
  App,
  Form,
  Result,
  Empty,
  Tag,
  Tabs,
  Modal,
} from 'antd';
import { ArrowLeftOutlined, ImportOutlined, ExportOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { inventoryApi } from '@/lib/api/inventory';
import type { Availability } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';
import { FormSection, Field } from '@/components/d365/FormLayout';
import { CommandBar } from '@/components/d365/CommandBar';

export default function InventoryDetailPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ sku: string }>();
  const sku = decodeURIComponent(params.sku);

  // Receive stock
  const [openReceive, setOpenReceive] = useState(false);
  const [receiveForm] = Form.useForm<{ quantity: number }>();

  // Issue stock (goods-out)
  const [openIssue, setOpenIssue] = useState(false);
  const [issueForm] = Form.useForm<{ quantity: number; reason?: string }>();

  // Availability check
  const [openAvail, setOpenAvail] = useState(false);
  const [availForm] = Form.useForm<{ quantity: number }>();
  const [availResult, setAvailResult] = useState<Availability | null>(null);
  const [availLoading, setAvailLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Queries & Mutations
  // ---------------------------------------------------------------------------
  const itemQuery = useQuery({
    queryKey: ['inventory', sku],
    queryFn: () => inventoryApi.get(sku),
  });

  const receiveMutation = useMutation({
    mutationFn: (quantity: number) => inventoryApi.receive(sku, quantity),
    onSuccess: (_, qty) => {
      message.success(`Stock imported ${qty} units`);
      setOpenReceive(false);
      receiveForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const issueMutation = useMutation({
    mutationFn: (input: { quantity: number; reason?: string }) =>
      inventoryApi.issue(sku, input),
    onSuccess: (_, vars) => {
      message.success(`Stock issued ${vars.quantity} units`);
      setOpenIssue(false);
      issueForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inventory', sku] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleCheckAvailability = async (values: { quantity: number }) => {
    setAvailLoading(true);
    try {
      const result = await inventoryApi.availability(sku, values.quantity);
      setAvailResult(result);
    } catch (err) {
      message.error(toMessage(err));
    } finally {
      setAvailLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading / Error / Not Found states
  // ---------------------------------------------------------------------------
  if (itemQuery.isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="Loading…" />
      </div>
    );
  }

  if (itemQuery.error) {
    const isNotFound =
      itemQuery.error instanceof ApiError && itemQuery.error.isNotFound;

    if (isNotFound) {
      return (
        <Result
          status="404"
          title="Not found"
          subTitle={`SKU "${sku}" does not exist.`}
          extra={
            <Link href="/inventory">
              <Button type="primary">Back to Inventory</Button>
            </Link>
          }
        />
      );
    }

    return (
      <Alert
        type="error"
        showIcon
        message="Failed to load data"
        description={toMessage(itemQuery.error)}
        action={
          <Button onClick={() => itemQuery.refetch()}>Retry</Button>
        }
      />
    );
  }

  const item = itemQuery.data!;

  const getQuantityColor = (v: number): string => {
    if (v < 10) return '#ff4d4f';
    if (v <= 50) return '#faad14';
    return '#52c41a';
  };

  const stockTag =
    item.quantityAvailable === 0 ? (
      <Tag color="error">Out of Stock</Tag>
    ) : item.quantityAvailable <= 20 ? (
      <Tag color="warning">Low Stock</Tag>
    ) : (
      <Tag color="success">In Stock</Tag>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space align="center" size={12}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {item.name}
        </Typography.Title>
        {stockTag}
      </Space>

      {/* D365 command bar */}
      <CommandBar>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push('/inventory')}>
          Back
        </Button>
        <Button type="text" icon={<ImportOutlined />} onClick={() => setOpenReceive(true)}>
          Import Stock
        </Button>
        <Button type="text" icon={<ExportOutlined />} onClick={() => setOpenIssue(true)}>
          Issue Stock
        </Button>
        <Button
          type="text"
          icon={<SearchOutlined />}
          onClick={() => {
            setAvailResult(null);
            availForm.resetFields();
            setOpenAvail(true);
          }}
        >
          Check Availability
        </Button>
      </CommandBar>

      {/* D365-style tabbed form: General tab with sectioned, 2-column fields */}
      <Card style={{ borderRadius: 12, border: '1px solid var(--surface-border)' }}>
        <Tabs
          defaultActiveKey="general"
          items={[
            {
              key: 'general',
              label: 'General',
              children: (
                <Space direction="vertical" size={28} style={{ width: '100%' }}>
                  <FormSection title="Stock">
                    <Field label="SKU">
                      <Typography.Text keyboard>{item.sku}</Typography.Text>
                    </Field>
                    <Field label="Product Name">{item.name}</Field>
                    <Field label="Qty Available">
                      <Typography.Text strong style={{ color: getQuantityColor(item.quantityAvailable) }}>
                        {item.quantityAvailable.toLocaleString('vi-VN')}
                      </Typography.Text>
                    </Field>
                    <Field label="Qty Reserved">
                      {item.quantityReserved.toLocaleString('vi-VN')}
                    </Field>
                    <Field label="Total On Hand">
                      {(item.quantityAvailable + item.quantityReserved).toLocaleString('vi-VN')}
                    </Field>
                    <Field label="Status">{stockTag}</Field>
                  </FormSection>

                  <FormSection title="System information">
                    <Field label="Version">{item.version}</Field>
                    <Field label="Created">{formatDateTime(item.createdAt)}</Field>
                    <Field label="Last Updated">{formatDateTime(item.updatedAt)}</Field>
                  </FormSection>

                  <FormSection title="Stock movement history">
                    <Empty
                      description={
                        <Typography.Text type="secondary">
                          Stock movement history will be available when the backend provides
                          a movement log endpoint.
                        </Typography.Text>
                      }
                    />
                  </FormSection>
                </Space>
              ),
            },
            { key: 'related', label: 'Related', disabled: true },
          ]}
        />
      </Card>

      {/* ---- Receive Stock Modal ---- */}
      <Modal
        title={`Import Stock — ${item.sku}`}
        open={openReceive}
        onCancel={() => {
          setOpenReceive(false);
          receiveForm.resetFields();
        }}
        onOk={() => receiveForm.submit()}
        confirmLoading={receiveMutation.isPending}
        okText="Import Stock"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form<{ quantity: number }>
          form={receiveForm}
          layout="vertical"
          onFinish={(values) => receiveMutation.mutate(values.quantity)}
        >
          <Form.Item
            label="Import Quantity"
            name="quantity"
            rules={[
              { required: true, message: 'Please enter quantity' },
              { type: 'number', min: 1, message: 'Quantity must be ≥ 1' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="Enter quantity"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Issue Stock Modal ---- */}
      <Modal
        title={`Issue Stock — ${item.sku}`}
        open={openIssue}
        onCancel={() => {
          setOpenIssue(false);
          issueForm.resetFields();
        }}
        onOk={() => issueForm.submit()}
        confirmLoading={issueMutation.isPending}
        okText="Issue Stock"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Form<{ quantity: number; reason?: string }>
          form={issueForm}
          layout="vertical"
          onFinish={(values) => issueMutation.mutate(values)}
        >
          <Form.Item
            label="Issue Quantity"
            name="quantity"
            rules={[
              { required: true, message: 'Please enter quantity' },
              { type: 'number', min: 1, message: 'Quantity must be ≥ 1' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="Enter quantity"
            />
          </Form.Item>
          <Form.Item label="Reason" name="reason">
            <Input placeholder="Optional reason (e.g. damaged, manual adjust)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- Availability Check Modal ---- */}
      <Modal
        title={`Check Availability — ${item.sku}`}
        open={openAvail}
        onCancel={() => {
          setOpenAvail(false);
          setAvailResult(null);
          availForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form<{ quantity: number }>
          form={availForm}
          layout="vertical"
          onFinish={handleCheckAvailability}
        >
          <Form.Item
            label="Quantity to Check"
            name="quantity"
            rules={[
              { required: true, message: 'Please enter quantity' },
              { type: 'number', min: 1, message: 'Quantity must be ≥ 1' },
            ]}
          >
            <InputNumber<number>
              style={{ width: '100%' }}
              min={1}
              precision={0}
              placeholder="Enter quantity"
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={availLoading}>
              Check
            </Button>
          </Form.Item>
        </Form>

        {availResult && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Statistic title="Available" value={availResult.available} />
            </Col>
            <Col span={6}>
              <Statistic title="Reserved" value={availResult.reserved} />
            </Col>
            <Col span={6}>
              <Statistic title="Total" value={availResult.total} />
            </Col>
            <Col span={6}>
              <Statistic
                title="Can Reserve"
                valueRender={() => (
                  <Badge
                    status={availResult.canReserve ? 'success' : 'error'}
                    text={availResult.canReserve ? 'Yes' : 'No'}
                  />
                )}
              />
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
}
