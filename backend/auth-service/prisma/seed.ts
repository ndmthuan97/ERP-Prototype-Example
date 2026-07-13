// =============================================================================
// SEED SCRIPT — Bootstrap allowlist users for all roles (idempotent)
// =============================================================================
// Inserts the default bootstrap accounts into app_auth.users.
//
// Connection: mirrors PrismaService (@prisma/adapter-pg + pg connection string),
// but uses the DIRECT connection (DIRECT_URL) the same way the Prisma CLI does
// via prisma.config.ts — seeding/migrations should not go through the pooler.
//
// Idempotent: each user is UPSERTed by unique email, so re-running never
// duplicates rows and always refreshes the profile fields.
//
// Password-less under B1: Google/Identity Platform sign-in is the credential.
// Seeding just puts these emails on the allowlist; the firebaseUid links itself
// on first Google sign-in (ExchangeSessionCommand).
//
// SEED_ADMIN_EMAIL (optional): when set, an extra admin account with that email
// is seeded so the operator can allowlist their real Gmail and sign in with
// Google right away.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

interface SeedUser {
  email: string;
  role: string;
  fullName: string;
}

// Bootstrap allowlist accounts (password-less — Google sign-in is the credential).
// The old fake demo users (admin@/manager@/staff@gmail.com) are removed: they are
// not real Google accounts and can never sign in under B1. Provision real allowlist
// emails via SEED_ADMIN_EMAIL below, or INSERT them directly.
const USERS_TO_SEED: SeedUser[] = [];

// Optional: allowlist the operator's real Gmail as an admin so Google sign-in
// works out of the box. Deduped against the static list above by email.
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
if (adminEmail && !USERS_TO_SEED.some((u) => u.email === adminEmail)) {
  USERS_TO_SEED.push({
    email: adminEmail,
    role: 'admin',
    fullName: 'Seed Admin',
  });
}

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
      const upserted = await prisma.user.upsert({
        where: { email: user.email },
        // On update: refresh profile fields + reactivate. Leave firebaseUid
        // untouched (don't wipe a linked Google account on re-seed).
        update: {
          fullName: user.fullName,
          role: user.role,
          isActive: true,
        },
        // On create: allowlist row with an explicit uuid id
        // (matches RegisterCommand, which generates the id with uuid.v4()).
        create: {
          id: uuidv4(),
          email: user.email,
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
