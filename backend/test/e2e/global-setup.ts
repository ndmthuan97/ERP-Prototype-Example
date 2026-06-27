/**
 * Jest Global Setup — runs ONCE before all test suites.
 * Logs in and creates all seed data, saves to a temp file
 * that individual suites can read.
 */
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3010';
const SEED_FILE = path.join(__dirname, '.seed-data.json');

async function post(url: string, data: unknown, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return axios.post(`${BASE_URL}${url}`, data, {
    timeout: 15000,
    validateStatus: () => true,
    headers,
  });
}

module.exports = async function globalSetup() {
  console.log('\n🌱 E2E Global Setup — seeding test data...');

  // 1. Login
  const loginRes = await post('/api/auth/login', {
    email: 'admin@gmail.com',
    password: 'Admin@123',
  });
  if (loginRes.status !== 200) {
    throw new Error(`Login failed (${loginRes.status}): ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.accessToken;
  const refreshToken = loginRes.data.refreshToken;
  console.log('  ✅ Login OK');

  const authPost = (url: string, data: unknown) => post(url, data, token);
  const runId = Date.now().toString().slice(-8);

  // 2. Customer
  const custRes = await authPost('/api/customers', {
    businessName: `E2E Customer ${runId}`,
    taxCode: `03${runId}`,
    contactName: 'E2E Tester',
    contactPhone: '0901234567',
    contactEmail: `e2e-${runId}@test.com`,
    creditLimitAmount: 10_000_000,
  });
  if (custRes.status !== 201) {
    throw new Error(`Create customer failed (${custRes.status}): ${JSON.stringify(custRes.data)}`);
  }
  console.log('  ✅ Customer created');

  // 3. Products
  const skuA = `E2E-A-${runId}`;
  const skuB = `E2E-B-${runId}`;

  const prodA = await authPost('/api/catalog/products', {
    sku: skuA, name: `E2E Alpha ${runId}`, unit: 'pcs', defaultSalePrice: 1000,
  });
  if (prodA.status !== 201) {
    throw new Error(`Create product A failed (${prodA.status}): ${JSON.stringify(prodA.data)}`);
  }

  const prodB = await authPost('/api/catalog/products', {
    sku: skuB, name: `E2E Beta ${runId}`, unit: 'pcs', defaultSalePrice: 500,
  });
  if (prodB.status !== 201) {
    throw new Error(`Create product B failed (${prodB.status}): ${JSON.stringify(prodB.data)}`);
  }
  console.log('  ✅ Products created');

  // 4. Stock items (direct API)
  const stockA = await authPost('/api/inventory/items', { sku: skuA, name: `E2E Alpha ${runId}` });
  if (stockA.status !== 201) {
    throw new Error(`Create stock A failed (${stockA.status}): ${JSON.stringify(stockA.data)}`);
  }
  const stockB = await authPost('/api/inventory/items', { sku: skuB, name: `E2E Beta ${runId}` });
  if (stockB.status !== 201) {
    throw new Error(`Create stock B failed (${stockB.status}): ${JSON.stringify(stockB.data)}`);
  }
  console.log('  ✅ Stock items created');

  // 5. Receive stock
  const recvA = await authPost(`/api/inventory/items/${skuA}/receive`, { quantity: 100 });
  if (recvA.status !== 200 && recvA.status !== 201) {
    throw new Error(`Receive A failed (${recvA.status}): ${JSON.stringify(recvA.data)}`);
  }
  const recvB = await authPost(`/api/inventory/items/${skuB}/receive`, { quantity: 100 });
  if (recvB.status !== 200 && recvB.status !== 201) {
    throw new Error(`Receive B failed (${recvB.status}): ${JSON.stringify(recvB.data)}`);
  }
  console.log('  ✅ Stock received (100 each)');

  // 6. Supplier
  const supplier = await authPost('/api/suppliers', {
    name: `E2E Supplier ${runId}`,
    contactName: 'Supplier Contact',
    contactPhone: '0907654321',
    paymentTermDays: 30,
  });
  if (supplier.status !== 201) {
    throw new Error(`Create supplier failed (${supplier.status}): ${JSON.stringify(supplier.data)}`);
  }
  console.log('  ✅ Supplier created');

  // Save to file for suites to read
  const seedData = {
    accessToken: token,
    refreshToken,
    customerId: custRes.data.id,
    productA: { id: prodA.data.id, sku: skuA, name: `E2E Alpha ${runId}` },
    productB: { id: prodB.data.id, sku: skuB, name: `E2E Beta ${runId}` },
    stockItemA: { id: stockA.data.id, sku: skuA },
    stockItemB: { id: stockB.data.id, sku: skuB },
    supplierId: supplier.data.id,
  };

  fs.writeFileSync(SEED_FILE, JSON.stringify(seedData, null, 2));
  console.log('  ✅ Seed data saved to', SEED_FILE);
  console.log('🌱 Global Setup complete!\n');
};
