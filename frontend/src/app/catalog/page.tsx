'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Card,
  Row,
  Col,
  Select,
  Tooltip,
  App,
  InputNumber
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { catalogApi, type Product } from '@/lib/api/catalog';
import { formatVnd } from '@/lib/format';
import { StatCard } from '@/components/StatCard';
import { toMessage } from '@/lib/api/errors';

export default function CatalogPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm();

  // Edit modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm] = Form.useForm();

  // Queries
  const listQuery = useQuery({
    queryKey: ['catalog', { q, page, limit, isActive }],
    queryFn: () => catalogApi.list({ q, page, limit, isActive }),
  });

  const statsQuery = useQuery({
    queryKey: ['catalog', 'stats-all'],
    queryFn: () => catalogApi.list({ page: 1, limit: 1000 }),
    staleTime: 5 * 60 * 1000,
  });

  // Derived stat values
  const stats = useMemo(() => {
    const total = statsQuery.data?.total ?? listQuery.data?.total ?? 0;
    const products = statsQuery.data?.data ?? listQuery.data?.data ?? [];

    const activeCount = products.filter((p) => p.isActive).length;
    const inactiveCount = products.filter((p) => !p.isActive).length;

    const totalPrices = products.reduce((sum, p) => sum + p.defaultSalePrice, 0);
    const averagePrice = products.length > 0 ? totalPrices / products.length : 0;

    return {
      total: String(total),
      activeCount: String(activeCount),
      inactiveCount: String(inactiveCount),
      averagePrice: formatVnd(averagePrice)
    };
  }, [statsQuery.data, listQuery.data]);

  const editQuery = useQuery({
    queryKey: ['catalog', editingId],
    queryFn: () => catalogApi.get(editingId!),
    enabled: !!editingId,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => catalogApi.create(data),
    onSuccess: () => {
      message.success('Đã tạo sản phẩm');
      setOpenCreate(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => catalogApi.update(editingId!, data),
    onSuccess: () => {
      message.success('Đã cập nhật sản phẩm');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => catalogApi.activate(id),
    onSuccess: () => {
      message.success('Đã kích hoạt sản phẩm');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => catalogApi.deactivate(id),
    onSuccess: () => {
      message.success('Đã ngừng hoạt động sản phẩm');
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (err) => message.error(toMessage(err)),
  });

  const handleOpenEdit = (record: Product) => {
    setEditingId(record.id);
    editForm.setFieldsValue({
      sku: record.sku,
      name: record.name,
      unit: record.unit,
      defaultSalePrice: record.defaultSalePrice,
    });
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (v) => <Typography.Text keyboard>{v}</Typography.Text>,
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
    },
    {
      title: 'Giá bán mặc định',
      dataIndex: 'defaultSalePrice',
      key: 'defaultSalePrice',
      width: 150,
      align: 'right',
      render: (v) => formatVnd(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 140,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Chi tiết">
            <Button type="text" icon={<EyeOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          {record.isActive ? (
            <Tooltip title="Ngừng hoạt động">
              <Button
                type="text"
                danger
                icon={<StopOutlined />}
                size="small"
                onClick={() => deactivateMutation.mutate(record.id)}
                loading={deactivateMutation.isPending && deactivateMutation.variables === record.id}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Kích hoạt">
              <Button
                type="text"
                style={{ color: '#52c41a' }}
                icon={<CheckCircleOutlined />}
                size="small"
                onClick={() => activateMutation.mutate(record.id)}
                loading={activateMutation.isPending && activateMutation.variables === record.id}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const renderFormFields = () => (
    <>
      <Form.Item
        name="sku"
        label="SKU"
        rules={[{ required: true, message: 'Vui lòng nhập SKU' }]}
      >
        <Input placeholder="Nhập mã SKU..." />
      </Form.Item>
      <Form.Item
        name="name"
        label="Tên sản phẩm"
        rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}
      >
        <Input placeholder="Nhập tên sản phẩm..." />
      </Form.Item>
      <Form.Item
        name="unit"
        label="Đơn vị tính"
        rules={[{ required: true, message: 'Vui lòng nhập đơn vị tính' }]}
      >
        <Input placeholder="VD: Cái, Hộp, Chiếc..." />
      </Form.Item>
      <Form.Item
        name="defaultSalePrice"
        label="Giá bán mặc định"
        rules={[{ required: true, message: 'Vui lòng nhập giá bán' }]}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
          addonAfter="VNĐ"
        />
      </Form.Item>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Danh mục sản phẩm
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setOpenCreate(true)}
        >
          Thêm sản phẩm
        </Button>
      </Space>

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<AppstoreOutlined />}
            iconBgColor="rgba(22, 119, 255, 0.1)"
            iconColor="#1677ff"
            label="Tổng sản phẩm"
            value={stats.total}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CheckCircleOutlined />}
            iconBgColor="rgba(82, 196, 26, 0.1)"
            iconColor="#52c41a"
            label="Đang hoạt động"
            value={stats.activeCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<StopOutlined />}
            iconBgColor="rgba(245, 34, 45, 0.1)"
            iconColor="#f5222d"
            label="Ngừng hoạt động"
            value={stats.inactiveCount}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<DollarOutlined />}
            iconBgColor="rgba(250, 173, 20, 0.1)"
            iconColor="#faad14"
            label="Giá TB"
            value={stats.averagePrice}
          />
        </Col>
      </Row>

      <Card
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="Tìm theo mã SKU, tên..."
            style={{ width: 320 }}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            style={{ width: 180 }}
            onChange={(val) => {
              setIsActive(val);
              setPage(1);
            }}
            options={[
              { value: true, label: 'Đang hoạt động' },
              { value: false, label: 'Ngừng hoạt động' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => listQuery.refetch()}
          >
            Tải lại
          </Button>
        </Space>
      </Card>

      <Card
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
      >
        <Table<Product>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.data ?? []}
          loading={listQuery.isFetching}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize: limit,
            total: listQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `${total} sản phẩm`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setLimit(nextSize);
            },
          }}
        />
      </Card>

      <Modal
        title="Thêm sản phẩm"
        open={openCreate}
        onCancel={() => setOpenCreate(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Tạo"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutateAsync(values)}
        >
          {renderFormFields()}
        </Form>
      </Modal>

      <Modal
        title="Sửa sản phẩm"
        open={!!editingId}
        onCancel={() => setEditingId(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateMutation.mutateAsync(values)}
        >
          {renderFormFields()}
        </Form>
      </Modal>
    </div>
  );
}
