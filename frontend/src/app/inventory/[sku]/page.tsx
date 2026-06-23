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
} from 'antd';
import { HomeOutlined, ImportOutlined, SearchOutlined } from '@ant-design/icons';
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
      message.success(`Đã nhập kho ${qty} đơn vị`);
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
        <Spin size="large" tip="Đang tải…" />
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
          title="Không tìm thấy"
          subTitle={`SKU "${sku}" không tồn tại trong hệ thống.`}
          extra={
            <Link href="/inventory">
              <Button type="primary">Về danh sách tồn kho</Button>
            </Link>
          }
        />
      );
    }

    return (
      <Alert
        type="error"
        showIcon
        message="Lỗi tải dữ liệu"
        description={toMessage(itemQuery.error)}
        action={
          <Button onClick={() => itemQuery.refetch()}>Thử lại</Button>
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
                <HomeOutlined /> Tổng quan
              </Link>
            ),
          },
          {
            title: <Link href="/inventory">Tồn kho</Link>,
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
        <Descriptions.Item label="Tên sản phẩm">{item.name}</Descriptions.Item>
        <Descriptions.Item label="SL khả dụng">
          {item.quantityAvailable.toLocaleString('vi-VN')}
        </Descriptions.Item>
        <Descriptions.Item label="SL đã giữ">
          {item.quantityReserved.toLocaleString('vi-VN')}
        </Descriptions.Item>
        <Descriptions.Item label="Phiên bản (version)">
          {item.version}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">
          {formatDateTime(item.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Cập nhật lần cuối">
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
                Nhập kho
              </Space>
            }
          >
            <Form layout="inline" onFinish={() => receiveQty && receiveMutation.mutate(receiveQty)}>
              <Form.Item label="Số lượng">
                <InputNumber<number>
                  min={1}
                  precision={0}
                  value={receiveQty}
                  onChange={(v) => setReceiveQty(v)}
                  placeholder="Nhập SL"
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
                  Nhập kho
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
                Kiểm tra tồn
              </Space>
            }
          >
            <Form layout="inline" onFinish={handleCheckAvailability}>
              <Form.Item label="Số lượng">
                <InputNumber<number>
                  min={1}
                  precision={0}
                  value={availQty}
                  onChange={(v) => setAvailQty(v)}
                  placeholder="Nhập SL"
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
                  Kiểm tra
                </Button>
              </Form.Item>
            </Form>

            {availResult && (
              <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                <Col span={6}>
                  <Statistic title="Khả dụng" value={availResult.available} />
                </Col>
                <Col span={6}>
                  <Statistic title="Đã giữ" value={availResult.reserved} />
                </Col>
                <Col span={6}>
                  <Statistic title="Tổng" value={availResult.total} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Có thể giữ"
                    valueRender={() => (
                      <Badge
                        status={availResult.canReserve ? 'success' : 'error'}
                        text={availResult.canReserve ? 'Có' : 'Không'}
                      />
                    )}
                  />
                </Col>
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
