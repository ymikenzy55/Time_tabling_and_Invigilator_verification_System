import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'yeboahmichael977@gmail.com';
  const password = '!@Firatata45';
  const fullName = 'System Administrator';
  const staffId = 'SA-0001';

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

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
