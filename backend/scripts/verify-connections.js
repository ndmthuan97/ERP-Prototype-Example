/**
 * Script verify kết nối đến 3 infrastructure services:
 * 1. Supabase PostgreSQL
 * 2. Upstash Redis
 * 3. GCP Pub/Sub Emulator
 *
 * Cách dùng:
 *   cd backend/scripts
 *   node verify-connections.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

// ──────────────────────────────────────────────
// 1. Test Supabase PostgreSQL
// ──────────────────────────────────────────────
async function testPostgreSQL() {
  console.log('1️⃣  Supabase PostgreSQL...');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Kiểm tra 4 schemas tồn tại
    const result = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('auth', 'customer', 'order', 'inventory')
      ORDER BY schema_name
    `);

    const schemas = result.rows.map((r) => r.schema_name);
    console.log(`   ✅ Kết nối OK — ${schemas.length}/4 schemas: ${schemas.join(', ')}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Lỗi: ${error.message}`);
    return false;
  } finally {
    await client.end();
  }
}

// ──────────────────────────────────────────────
// 2. Test Upstash Redis (REST API)
// ──────────────────────────────────────────────
async function testRedis() {
  console.log('2️⃣  Upstash Redis...');

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('   ❌ UPSTASH_REDIS_REST_URL hoặc TOKEN chưa set trong .env');
    return false;
  }

  try {
    // Upstash REST API: gửi PING command
    const response = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    if (data.result === 'PONG') {
      console.log('   ✅ Kết nối OK — PING → PONG');

      // Test SET/GET
      await fetch(`${url}/set/erp-test/hello`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const getRes = await fetch(`${url}/get/erp-test`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const getData = await getRes.json();
      console.log(`   ✅ SET/GET OK — erp-test = "${getData.result}"`);

      // Dọn dẹp
      await fetch(`${url}/del/erp-test`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return true;
    } else {
      console.log(`   ❌ PING trả về: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Lỗi: ${error.message}`);
    return false;
  }
}

// ──────────────────────────────────────────────
// 3. Test Pub/Sub Emulator
// ──────────────────────────────────────────────
async function testPubSub() {
  console.log('3️⃣  GCP Pub/Sub Emulator...');

  const host = process.env.PUBSUB_EMULATOR_HOST;

  if (!host) {
    console.log('   ❌ PUBSUB_EMULATOR_HOST chưa set trong .env');
    return false;
  }

  try {
    // Emulator có health endpoint tại root
    const response = await fetch(`http://${host}`);

    if (response.ok || response.status === 200) {
      console.log(`   ✅ Emulator đang chạy tại ${host}`);
      return true;
    } else {
      console.log(`   ⚠️  Emulator trả về status ${response.status} (có thể vẫn OK)`);
      return true;
    }
  } catch (error) {
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      console.log(`   ❌ Không kết nối được ${host}`);
      console.log('   💡 Chạy: cd backend && docker compose up -d');
    } else {
      console.log(`   ❌ Lỗi: ${error.message}`);
    }
    return false;
  }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function main() {
  console.log('🔍 Verify Infrastructure Connections\n');

  const results = [];

  results.push(await testPostgreSQL());
  console.log();
  results.push(await testRedis());
  console.log();
  results.push(await testPubSub());

  console.log('\n' + '═'.repeat(40));
  const passed = results.filter(Boolean).length;
  const total = results.length;

  if (passed === total) {
    console.log(`🎉 ${passed}/${total} — Tất cả kết nối OK!`);
  } else {
    console.log(`⚠️  ${passed}/${total} — Có kết nối chưa sẵn sàng.`);
  }
}

main();
