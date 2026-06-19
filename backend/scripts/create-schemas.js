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
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

async function main() {
  // Thử DIRECT_URL trước (port 5432, direct connection)
  // Nếu không có, fallback sang DATABASE_URL (port 6543, pooler)
  // CREATE SCHEMA chạy được trên cả 2, nhưng Prisma migrate cần direct
  const connectionString = process.env.DATABASE_URL;

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

    // Tạo 4 schemas — mỗi service sở hữu 1 schema riêng
    // "order" cần ngoặc kép vì là reserved word trong SQL
    const schemas = ['customer', '"order"', 'inventory'];

    for (const schema of schemas) {
      const sql = `CREATE SCHEMA IF NOT EXISTS ${schema}`;
      await client.query(sql);
      const displayName = schema.replace(/"/g, '');
      console.log(`  ✅ Schema "${displayName}" — tạo thành công (hoặc đã tồn tại)`);
    }

    // Schema "auth" — Supabase đã tạo sẵn cho Supabase Auth
    // Kiểm tra trước, nếu đã có thì dùng luôn
    const authCheck = await client.query(`
      SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth'
    `);

    if (authCheck.rows.length > 0) {
      console.log(`  ℹ️  Schema "auth" — đã tồn tại (Supabase tạo sẵn), dùng luôn`);
    } else {
      await client.query('CREATE SCHEMA IF NOT EXISTS auth');
      console.log(`  ✅ Schema "auth" — tạo thành công`);
    }

    // Verify — liệt kê tất cả schemas đã tạo
    console.log('\n📋 Verify — Danh sách schemas:');
    const result = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('auth', 'customer', 'order', 'inventory')
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
