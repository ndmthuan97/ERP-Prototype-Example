/**
 * Seed Script — tạo data mẫu qua REST API
 *
 * Chạy: node seed.mjs
 *
 * Tạo:
 *   - 10 khách hàng
 *   - 15 sản phẩm (có nhập kho)
 *   - 5 đơn hàng (draft, có dòng hàng)
 */

const CUSTOMER_URL = 'http://localhost:3001/customers';
const INVENTORY_URL = 'http://localhost:3003/inventory/items';
const ORDER_URL = 'http://localhost:3002/orders';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    // 409 = duplicate → skip silently
    if (res.status === 409) {
      console.log(`  ⚠ Đã tồn tại, bỏ qua: ${url}`);
      return null;
    }
    throw new Error(`${res.status} ${url}: ${text}`);
  }
  return res.json();
}

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status} ${url}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────

const CUSTOMERS = [
  { businessName: 'Công ty TNHH WeCare Việt Nam', taxCode: '0101234567', contactName: 'Nguyễn Văn An', contactPhone: '0901234567', contactEmail: 'an.nguyen@wecare.vn', creditLimitAmount: 500000000 },
  { businessName: 'Công ty CP Mỹ Phẩm Sài Gòn', taxCode: '0312345678', contactName: 'Trần Thị Bình', contactPhone: '0912345678', contactEmail: 'binh.tran@myphamsg.com', creditLimitAmount: 300000000 },
  { businessName: 'Chuỗi nhà thuốc PharmCity', taxCode: '0109876543', contactName: 'Lê Hoàng Cường', contactPhone: '0923456789', contactEmail: 'cuong.le@pharmcity.vn', creditLimitAmount: 1000000000 },
  { businessName: 'Spa & Wellness Hoa Sen', taxCode: '0401122334', contactName: 'Phạm Minh Duyên', contactPhone: '0934567890', contactEmail: 'duyen.pham@hoasenspa.com', creditLimitAmount: 150000000 },
  { businessName: 'Siêu thị Mega Market', taxCode: '0305566778', contactName: 'Hoàng Đức Em', contactPhone: '0945678901', contactEmail: 'em.hoang@megamarket.vn', creditLimitAmount: 2000000000 },
  { businessName: 'Công ty TNHH Dược phẩm Hà Nội', taxCode: '0106677889', contactName: 'Vũ Thị Phương', contactPhone: '0956789012', contactEmail: 'phuong.vu@duocphamhn.com', creditLimitAmount: 800000000 },
  { businessName: 'Beauty Box Vietnam', taxCode: '0313344556', contactName: 'Đặng Quốc Gia', contactPhone: '0967890123', contactEmail: 'gia.dang@beautybox.vn', creditLimitAmount: 250000000 },
  { businessName: 'Clinic Dr. Hùng', taxCode: '0108899001', contactName: 'Bùi Thanh Hùng', contactPhone: '0978901234', contactEmail: 'hung.bui@drhung.vn', creditLimitAmount: 100000000 },
  { businessName: 'Guardian Health & Beauty', taxCode: '0302233445', contactName: 'Ngô Thị Ivy', contactPhone: '0989012345', contactEmail: 'ivy.ngo@guardian.vn', creditLimitAmount: 1500000000 },
  { businessName: 'Công ty CP Thương mại Toàn Cầu', taxCode: '0107788990', contactName: 'Mai Văn Khoa', contactPhone: '0990123456', contactEmail: 'khoa.mai@toancau.com', creditLimitAmount: 600000000 },
];

const PRODUCTS = [
  { sku: 'WC-CLN-001', name: 'Gel rửa mặt WeCare 150ml', initialQuantity: 500 },
  { sku: 'WC-CLN-002', name: 'Sữa rửa mặt tạo bọt WeCare 200ml', initialQuantity: 350 },
  { sku: 'WC-TNR-001', name: 'Toner cân bằng da WeCare 150ml', initialQuantity: 420 },
  { sku: 'WC-TNR-002', name: 'Toner hoa hồng WeCare 200ml', initialQuantity: 280 },
  { sku: 'WC-SRM-001', name: 'Serum Vitamin C 15% WeCare 30ml', initialQuantity: 200 },
  { sku: 'WC-SRM-002', name: 'Serum Hyaluronic Acid WeCare 30ml', initialQuantity: 180 },
  { sku: 'WC-SRM-003', name: 'Serum Retinol 0.5% WeCare 30ml', initialQuantity: 150 },
  { sku: 'WC-MST-001', name: 'Kem dưỡng ẩm WeCare 50g', initialQuantity: 600 },
  { sku: 'WC-MST-002', name: 'Kem dưỡng ẩm ban đêm WeCare 50g', initialQuantity: 320 },
  { sku: 'WC-SUN-001', name: 'Kem chống nắng SPF50+ WeCare 50ml', initialQuantity: 800 },
  { sku: 'WC-SUN-002', name: 'Xịt chống nắng WeCare 150ml', initialQuantity: 250 },
  { sku: 'WC-MSK-001', name: 'Mặt nạ đất sét WeCare 100g', initialQuantity: 400 },
  { sku: 'WC-MSK-002', name: 'Mặt nạ giấy Vitamin E WeCare (5 miếng)', initialQuantity: 1000 },
  { sku: 'WC-EYE-001', name: 'Kem mắt chống lão hóa WeCare 15ml', initialQuantity: 120 },
  { sku: 'WC-LIP-001', name: 'Son dưỡng môi WeCare SPF15', initialQuantity: 700 },
];

// Prices per SKU (VND)
const PRICES = {
  'WC-CLN-001': 185000, 'WC-CLN-002': 215000,
  'WC-TNR-001': 245000, 'WC-TNR-002': 195000,
  'WC-SRM-001': 520000, 'WC-SRM-002': 450000, 'WC-SRM-003': 680000,
  'WC-MST-001': 320000, 'WC-MST-002': 380000,
  'WC-SUN-001': 350000, 'WC-SUN-002': 290000,
  'WC-MSK-001': 175000, 'WC-MSK-002': 120000,
  'WC-EYE-001': 490000, 'WC-LIP-001': 85000,
};

// ─────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────

async function seedCustomers() {
  console.log('\n📋 Tạo khách hàng...');
  const ids = [];
  for (const c of CUSTOMERS) {
    try {
      const result = await post(CUSTOMER_URL, c);
      if (result) {
        ids.push(result.id);
        console.log(`  ✅ ${c.businessName} (${result.id.slice(0, 8)}…)`);
      } else {
        // 409 duplicate — fetch existing by searching businessName
        const list = await get(`${CUSTOMER_URL}?q=${encodeURIComponent(c.businessName)}&limit=1`);
        const existing = list?.data?.[0];
        if (existing) {
          ids.push(existing.id);
          console.log(`  ✅ ${c.businessName} — đã tồn tại (${existing.id.slice(0, 8)}…)`);
        }
      }
    } catch (e) {
      console.error(`  ❌ ${c.businessName}: ${e.message}`);
    }
  }
  return ids;
}

async function seedProducts() {
  console.log('\n📦 Tạo sản phẩm...');
  const items = [];
  for (const p of PRODUCTS) {
    try {
      const result = await post(INVENTORY_URL, p);
      if (result) {
        items.push(result);
        console.log(`  ✅ ${p.sku} — ${p.name} (SL: ${p.initialQuantity})`);
      } else {
        // Already exists, fetch it
        const existing = await get(`${INVENTORY_URL}/${encodeURIComponent(p.sku)}`);
        items.push(existing);
        console.log(`  ✅ ${p.sku} — đã tồn tại`);
      }
    } catch (e) {
      console.error(`  ❌ ${p.sku}: ${e.message}`);
    }
  }
  return items;
}

async function seedOrders(customerIds, products) {
  console.log('\n🛒 Tạo đơn hàng...');
  if (customerIds.length === 0 || products.length === 0) {
    console.log('  ⚠ Không đủ data khách hàng / sản phẩm để tạo đơn');
    return;
  }

  const orderConfigs = [
    { custIdx: 0, lines: [{ pIdx: 0, qty: 20 }, { pIdx: 4, qty: 10 }, { pIdx: 9, qty: 30 }] },
    { custIdx: 1, lines: [{ pIdx: 7, qty: 50 }, { pIdx: 8, qty: 25 }] },
    { custIdx: 2, lines: [{ pIdx: 1, qty: 100 }, { pIdx: 2, qty: 80 }, { pIdx: 5, qty: 40 }, { pIdx: 10, qty: 60 }] },
    { custIdx: 4, lines: [{ pIdx: 11, qty: 200 }, { pIdx: 12, qty: 500 }, { pIdx: 14, qty: 300 }] },
    { custIdx: 6, lines: [{ pIdx: 3, qty: 30 }, { pIdx: 6, qty: 15 }, { pIdx: 13, qty: 20 }] },
  ];

  for (const cfg of orderConfigs) {
    const custId = customerIds[cfg.custIdx];
    if (!custId) continue;

    try {
      // Create draft
      const order = await post(ORDER_URL, { customerId: custId });
      if (!order) continue;
      console.log(`  ✅ Đơn ${order.id.slice(0, 8)}… cho KH ${custId.slice(0, 8)}…`);

      // Add lines
      for (const line of cfg.lines) {
        const product = products[line.pIdx];
        if (!product) continue;

        await post(`${ORDER_URL}/${order.id}/lines`, {
          itemId: product.id,
          itemName: product.name,
          quantity: line.qty,
          unitPrice: PRICES[product.sku] || 100000,
        });
        console.log(`    + ${product.sku} x${line.qty}`);
      }
    } catch (e) {
      console.error(`  ❌ Đơn hàng: ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Bắt đầu seed data...');
  console.log(`   Customer API: ${CUSTOMER_URL}`);
  console.log(`   Inventory API: ${INVENTORY_URL}`);
  console.log(`   Sales API:     ${ORDER_URL}`);

  // Check services are up
  try {
    await get(`${CUSTOMER_URL}?limit=1`);
  } catch {
    console.error('\n❌ Không kết nối được Customer Service (port 3001). Đảm bảo backend đang chạy!');
    process.exit(1);
  }

  const customerIds = await seedCustomers();
  const products = await seedProducts();
  await seedOrders(customerIds, products);

  console.log('\n✨ Seed hoàn tất!');
  console.log(`   ${customerIds.length} khách hàng`);
  console.log(`   ${products.length} sản phẩm`);
  console.log(`   5 đơn hàng draft`);
}

main().catch((e) => {
  console.error('💥 Lỗi:', e);
  process.exit(1);
});
