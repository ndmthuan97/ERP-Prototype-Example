// =============================================================================
// FORMAT HELPERS — tiền VND (số nguyên đồng) + ngày giờ
// =============================================================================
// BE ép creditLimit/unitPrice/totalAmount là số NGUYÊN (đồng), không phần lẻ.

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return vndFormatter.format(amount);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN');
}
