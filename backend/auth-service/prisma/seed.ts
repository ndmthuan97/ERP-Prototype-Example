// =============================================================================
// SEED SCRIPT — Create default users for all roles (idempotent)
// =============================================================================
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  });
  const prisma = new PrismaClient({ adapter });

  const usersToSeed = [
    { email: 'admin@gmail.com', fullName: 'System Admin', role: 'admin', passwordRaw: 'Admin@123' },
    { email: 'manager@gmail.com', fullName: 'Store Manager', role: 'manager', passwordRaw: 'Manager@123' },
    { email: 'staff@gmail.com', fullName: 'Sales Staff', role: 'staff', passwordRaw: 'Staff@123' },
  ];

  for (const user of usersToSeed) {
    const passwordHash = await bcrypt.hash(user.passwordRaw, 12);

    const upserted = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash, // Cập nhật lại password nếu user đã tồn tại
        fullName: user.fullName,
        role: user.role,
      },
      create: {
        email: user.email,
        passwordHash,
        fullName: user.fullName,
        role: user.role,
        isActive: true,
      },
    });

    console.log(`✅ User upserted: ${upserted.email} (role: ${upserted.role}, password: ${user.passwordRaw})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
