// =============================================================================
// SEED SCRIPT — Bootstrap login users for all roles (idempotent)
// =============================================================================
// Inserts the 3 default bootstrap accounts into app_auth.users.
//
// Connection: mirrors PrismaService (@prisma/adapter-pg + pg connection string),
// but uses the DIRECT connection (DIRECT_URL) the same way the Prisma CLI does
// via prisma.config.ts — seeding/migrations should not go through the pooler.
//
// Idempotent: each user is UPSERTed by unique email, so re-running never
// duplicates rows and always refreshes the password hash + profile fields.
//
// NOTE: Passwords are hashed with bcrypt (12 salt rounds) to match
// RegisterCommand (bcrypt.hash(password, 12)). The demo passwords below are
// intentional bootstrap credentials — the only secrets hardcoded here.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

const BCRYPT_SALT_ROUNDS = 12;

// Bootstrap accounts. Plaintext passwords are demo bootstrap creds only.
const USERS_TO_SEED = [
  {
    email: 'admin@gmail.com',
    passwordRaw: 'Admin@123',
    role: 'admin',
    fullName: 'Admin User',
  },
  {
    email: 'manager@gmail.com',
    passwordRaw: 'Manager@123',
    role: 'manager',
    fullName: 'Manager User',
  },
  {
    email: 'staff@gmail.com',
    passwordRaw: 'Staff@123',
    role: 'staff',
    fullName: 'Staff User',
  },
];

async function main(): Promise<void> {
  // Prefer the DIRECT connection (matches prisma.config.ts / Prisma CLI).
  const connectionString =
    process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';

  if (!connectionString) {
    throw new Error(
      'No database connection string found. Set DIRECT_URL (preferred) or DATABASE_URL in the environment.',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const summary: Array<{ email: string; role: string }> = [];

    for (const user of USERS_TO_SEED) {
      const passwordHash = await bcrypt.hash(
        user.passwordRaw,
        BCRYPT_SALT_ROUNDS,
      );

      const upserted = await prisma.user.upsert({
        where: { email: user.email },
        // On update: refresh security-sensitive + profile fields, reactivate.
        update: {
          passwordHash,
          fullName: user.fullName,
          role: user.role,
          isActive: true,
        },
        // On create: full row including an explicit uuid id (matches
        // RegisterCommand, which generates the id with uuid.v4()).
        create: {
          id: uuidv4(),
          email: user.email,
          passwordHash,
          fullName: user.fullName,
          role: user.role,
          isActive: true,
        },
      });

      summary.push({ email: upserted.email, role: upserted.role });
    }

    console.log('Seed complete. Bootstrap users upserted:');
    for (const { email, role } of summary) {
      console.log(`  - ${email} (role: ${role})`);
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    await prisma.$disconnect();
    throw err;
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
