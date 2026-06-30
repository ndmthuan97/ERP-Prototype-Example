'use client';
// =============================================================================
// PHASE 2 — TỒN KHO CHI TIẾT: xem item + nhập kho + kiểm tra tồn
// =============================================================================

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Typography,
  Descriptions,
  Card,
  InputNumber,
  Button,
  Space,
  Statistic,
  Badge,
  Row,
  Col,
  Breadcrumb,
  Spin,
  Alert,
  App,
  Form,
  Result,
  Empty,
} from 'antd';
import { HomeOutlined, ImportOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { inventoryApi } from '@/lib/api/inventory';
import type { Availability } from '@/lib/api/types';
import { ApiError, toMessage } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/format';

export default function InventoryDetailPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const params = useParams<{ sku: string }>();
  const sku = decodeURIComponent(params.sku);

  // Receive stock
  const [receiveQty, setReceiveQty] = useState<number | null>(null);

  // Availability check
  const [availQty, setAvailQty] = useState<number | null>(null);
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
      setReceiveQty(null);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleCheckAvailability = async () => {
    if (!availQty || availQty < 1) return;
    setAvailLoading(true);
    try {
      const result = await inventoryApi.availability(sku, availQty);
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

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* ---- Breadcrumb ---- */}
      <Breadcrumb
        items={[
          {
            title: (
              <Link href="/">
                <HomeOutlined /> Dashboard
              </Link>
            ),
          },
          {
            title: <Link href="/inventory">Inventory</Link>,
          },
          { title: item.sku },
        ]}
      />

      <Typography.Title level={3} style={{ margin: 0 }}>
        {item.name}
      </Typography.Title>

      {/* ---- Item Details ---- */}
      <Descriptions bordered column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="SKU">{item.sku}</Descriptions.Item>
        <Descriptions.Item label="Product Name">{item.name}</Descriptions.Item>
        <Descriptions.Item label="Qty Available">
          {item.quantityAvailable.toLocaleString('vi-VN')}
        </Descriptions.Item>
        <Descriptions.Item label="Qty Reserved">
          {item.quantityReserved.toLocaleString('vi-VN')}
        </Descriptions.Item>
        <Descriptions.Item label="Version (version)">
          {item.version}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {formatDateTime(item.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Last Updated">
          {formatDateTime(item.updatedAt)}
        </Descriptions.Item>
      </Descriptions>

      <Row gutter={[16, 16]}>
        {/* ---- Receive Stock Card ---- */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <ImportOutlined />
                Import Stock
              </Space>
            }
          >
            <Form layout="inline" onFinish={() => receiveQty && receiveMutation.mutate(receiveQty)}>
              <Form.Item label="Quantity">
                <InputNumber<number>
                  min={1}
                  precision={0}
                  value={receiveQty}
                  onChange={(v) => setReceiveQty(v)}
                  placeholder="Enter qty"
                  style={{ width: 140 }}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={receiveMutation.isPending}
                  disabled={!receiveQty || receiveQty < 1}
                >
                  Import Stock
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* ---- Availability Check Card ---- */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <SearchOutlined />
                Check Availability
              </Space>
            }
          >
            <Form layout="inline" onFinish={handleCheckAvailability}>
              <Form.Item label="Quantity">
                <InputNumber<number>
                  min={1}
                  precision={0}
                  value={availQty}
                  onChange={(v) => setAvailQty(v)}
                  placeholder="Enter qty"
                  style={{ width: 140 }}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={availLoading}
                  disabled={!availQty || availQty < 1}
                >
                  Check
                </Button>
              </Form.Item>
            </Form>

            {availResult && (
              <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
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
          </Card>
        </Col>
      </Row>

      {/* Stock Movement History — placeholder until BE provides endpoint */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            Stock Movement History
          </Space>
        }
      >
        <Empty
          description={
            <>
              <Typography.Text type="secondary">
                Stock movement history will be available when the backend provides
                a movement log endpoint.
              </Typography.Text>
            </>
          }
        />
      </Card>
    </Space>
  );
}
