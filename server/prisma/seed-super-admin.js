import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const admins = [
  {
    email: 'yeboahmichael977@gmail.com',
    password: '!@Firatata45',
    fullName: 'System Administrator',
    staffId: 'SA-0001',
  },
  {
    email: 'demoadmin@uenr.edu.gh',
    password: 'Demo@2026',
    fullName: 'Demo Administrator',
    staffId: 'DEMO-001',
  },
];

async function upsertAdmin({ email, password, fullName, staffId }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
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
    console.log(`[seed] Updated Super Admin credentials for ${email}`);
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

  console.log(`[seed] Created Super Admin: ${email} (id: ${user.id})`);
}

async function main() {
  for (const admin of admins) {
    await upsertAdmin(admin);
  }
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
