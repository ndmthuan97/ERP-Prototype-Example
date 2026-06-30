'use client';
// =============================================================================
// REUSABLE TABLE CELL COMPONENTS — consistent rendering across all list pages
// =============================================================================

import { Tag, Typography, Tooltip } from 'antd';

/** Truncated ID with copy-on-click */
export function IdCell({ id, onClick }: { id: string; onClick?: () => void }) {
  const short = id.slice(0, 8) + '…';
  return onClick ? (
    <Typography.Link onClick={onClick} style={{ color: '#1677ff', fontWeight: 500 }}>
      {short}
    </Typography.Link>
  ) : (
    <Typography.Text copyable={{ text: id }}>{short}</Typography.Text>
  );
}

/** Status tag with color map */
export function StatusCell({
  status,
  colorMap,
  labelMap,
}: {
  status: string;
  colorMap: Record<string, string>;
  labelMap: Record<string, string>;
}) {
  return (
    <Tag color={colorMap[status] ?? 'default'}>
      {labelMap[status] ?? status}
    </Tag>
  );
}

/** Currency cell — right-aligned, formatted VND */
export function CurrencyCell({ amount, formatter }: { amount: number | null | undefined; formatter: (v: number | null | undefined) => string }) {
  return (
    <span style={{ fontWeight: 500 }}>{formatter(amount)}</span>
  );
}

/** SKU code cell — monospace style */
export function SkuCell({ sku }: { sku: string }) {
  return (
    <Typography.Text code style={{ fontSize: 12 }}>
      {sku}
    </Typography.Text>
  );
}

/** Quantity cell with color coding based on thresholds */
export function QuantityCell({
  value,
  criticalThreshold = 10,
  warningThreshold = 50,
}: {
  value: number;
  criticalThreshold?: number;
  warningThreshold?: number;
}) {
  const color =
    value <= criticalThreshold
      ? '#ff4d4f'
      : value <= warningThreshold
        ? '#faad14'
        : '#52c41a';

  return (
    <span style={{ fontWeight: 600, color }}>{value.toLocaleString('vi-VN')}</span>
  );
}

/** Boolean active/inactive cell */
export function ActiveCell({ isActive }: { isActive: boolean }) {
  return (
    <Tag color={isActive ? 'green' : 'red'}>
      {isActive ? 'Active' : 'Inactive'}
    </Tag>
  );
}
