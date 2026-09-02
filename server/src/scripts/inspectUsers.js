import { prisma } from '../utils/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, role: true, status: true, staffId: true, department: { select: { name: true } } },
    orderBy: { role: 'asc' },
  });
  console.log('=== USERS (' + users.length + ') ===');
  for (const u of users) {
    console.log(`${u.role} | ${u.fullName} | ${u.email} | ${u.staffId} | dept: ${u.department?.name || 'none'} | status: ${u.status}`);
  }

  const departments = await prisma.department.findMany({
    select: { id: true, name: true, code: true, _count: { select: { users: true, courses: true } } },
    orderBy: { name: 'asc' },
  });
  console.log('\n=== DEPARTMENTS (' + departments.length + ') ===');
  for (const d of departments) {
    console.log(`${d.name} (${d.code}) | id: ${d.id} | heads: ${d._count.users} | courses: ${d._count.courses}`);
  }

  const courseCount = await prisma.course.count();
  console.log('\nTotal courses: ' + courseCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
