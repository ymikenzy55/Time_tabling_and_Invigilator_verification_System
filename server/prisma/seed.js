// Idempotent seed: creates the first Super Admin from env vars.
// Never expose a way to create Super Admins from the frontend.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

async function main() {
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;
  const fullName = env.SUPER_ADMIN_NAME || 'System Administrator';
  const staffId = env.SUPER_ADMIN_STAFF_ID || 'SA-0001';

  if (!email || !password) {
    console.log('[seed] SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set. Skipping.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  if (existing) {
    const matches = existing.passwordHash && await bcrypt.compare(password, existing.passwordHash);
    if (!matches) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          fullName,
          staffId,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
          approvedAt: existing.approvedAt ?? new Date(),
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: existing.id,
          action: 'USER.SEED_SUPER_ADMIN_RESET',
          targetType: 'User',
          targetId: existing.id,
          result: 'SUCCESS',
          metadata: { email },
        },
      });
      console.log(`[seed] Refreshed Super Admin credentials for ${email}`);
    } else {
      console.log(`[seed] Super Admin already exists with matching credentials: ${email}`);
    }
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      staffId,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      approvedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'USER.SEED_SUPER_ADMIN',
      targetType: 'User',
      targetId: user.id,
      result: 'SUCCESS',
      metadata: { email },
    },
  });

  console.log(`[seed] Created Super Admin: ${email}`);
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
