/**
 * Script tạo 4 schemas trên Supabase PostgreSQL
 * Chạy 1 lần duy nhất khi setup dự án
 *
 * Cách dùng:
 *   cd backend/scripts
 *   npm install
 *   node create-schemas.js
 */

// Đọc biến môi trường từ backend/.env
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { Client } = require('pg');

async function main() {
  // Thử DIRECT_URL trước (port 5432, direct connection)
  // Nếu không có, fallback sang DATABASE_URL (port 6543, pooler)
  // CREATE SCHEMA chạy được trên cả 2, nhưng direct connection ổn định hơn cho DDL
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Không tìm thấy DIRECT_URL hoặc DATABASE_URL trong .env');
    process.exit(1);
  }

  console.log('🔌 Đang kết nối Supabase PostgreSQL...');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase yêu cầu SSL
  });

  try {
    await client.connect();
    console.log('✅ Kết nối thành công!\n');

    // Tạo 4 schemas — mỗi service sở hữu 1 schema riêng.
    // LƯU Ý: Auth Service dùng "app_auth", KHÔNG dùng "auth" — schema "auth" do
    // Supabase quản lý (đặt bảng app vào đó có thể bị ghi đè/khoá khi Supabase nâng cấp).
    const schemas = ['app_auth', 'customer', 'sales', 'inventory'];

    for (const schema of schemas) {
      const sql = `CREATE SCHEMA IF NOT EXISTS ${schema}`;
      await client.query(sql);
      const displayName = schema.replace(/"/g, '');
      console.log(`  ✅ Schema "${displayName}" — tạo thành công (hoặc đã tồn tại)`);
    }

    // Verify — liệt kê tất cả schemas đã tạo
    console.log('\n📋 Verify — Danh sách schemas:');
    const result = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('app_auth', 'customer', 'sales', 'inventory')
      ORDER BY schema_name
    `);

    for (const row of result.rows) {
      console.log(`  ✔ ${row.schema_name}`);
    }

    console.log(`\n🎉 Hoàn thành! ${result.rows.length}/4 schemas sẵn sàng.`);
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
