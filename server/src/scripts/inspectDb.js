import { prisma } from '../utils/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, role: true, status: true, staffId: true, departmentId: true, department: { select: { name: true } } },
    orderBy: { role: 'asc' },
  });
  console.log('=== USERS ===');
  for (const u of users) {
    console.log(`  ${u.role} | ${u.fullName} | ${u.email} | ${u.staffId} | dept: ${u.department?.name || 'none'} | status: ${u.status}`);
  }

  const departments = await prisma.department.findMany({
    select: { id: true, name: true, code: true, _count: { select: { users: true, courses: true } } },
  });
  console.log('\n=== DEPARTMENTS ===');
  for (const d of departments) {
    console.log(`  ${d.name} (${d.code}) | heads: ${d._count.users} | courses: ${d._count.courses}`);
  }

  const courses = await prisma.course.findMany({
    select: { id: true, code: true, title: true, level: true, status: true, department: { select: { name: true } }, semester: { select: { name: true } } },
    orderBy: { code: 'asc' },
    take: 200,
  });
  console.log('\n=== COURSES ===');
  for (const c of courses) {
    console.log(`  ${c.code} | ${c.title} | L${c.level} | ${c.status} | dept: ${c.department?.name} | sem: ${c.semester?.name}`);
  }

  const semesters = await prisma.semester.findMany({
    select: { id: true, name: true, isActive: true, academicYear: { select: { name: true } } },
  });
  console.log('\n=== SEMESTERS ===');
  for (const s of semesters) {
    console.log(`  ${s.name} | active: ${s.isActive} | year: ${s.academicYear?.name}`);
  }

  const courseLevels = await prisma.courseLevel.findMany({
    select: { id: true, value: true, label: true, department: { select: { name: true } } },
  });
  console.log('\n=== COURSE LEVELS ===');
  for (const cl of courseLevels) {
    console.log(`  L${cl.value} ${cl.label || ''} | dept: ${cl.department?.name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
