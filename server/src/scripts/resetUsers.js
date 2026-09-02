import { prisma } from '../utils/prisma.js';
import bcrypt from 'bcryptjs';

const INVIGILATOR_NAMES = [
  'Kwame Mensah', 'Ama Owusu', 'Yaw Asante', 'Akosua Boateng', 'Kofi Appiah',
  'Adwoa Adjei', 'Kwabena Tetteh', 'Abena Sarpong', 'Kwesi Asare', 'Akua Osei',
  'Yaw Antwi', 'Afia Bonsu', 'Kojo Quaye', 'Esi Cudjoe', 'Kwaku Fosu',
  'Yaa Nyarko', 'Nana Amoah', 'Akwele Danso', 'Ekow Asabere', 'Ama Koomson',
  'Kwabena Yeboah', 'Adwoa Agyei', 'Kofi Larbi', 'Abena Karikari', 'Kwame Frimpong',
  'Akosua Dapaah', 'Kwesi Asiamah', 'Afia Tandoh', 'Kojo Boakye', 'Esi Agyeman',
  'Nana Darko', 'Yaa Baiden', 'Ekow Owusu-Dankwa', 'Akwele Ankomah', 'Yaw Peprah',
];

async function main() {
  console.log('=== Resetting users (keeping SUPER_ADMIN) ===\n');

  // 1. Delete all non-super-admin users
  // First, clean up related data that might block deletion
  console.log('Cleaning up related data...');

  // Null out invigilator/replacement references on Invigilation
  await prisma.invigilation.updateMany({
    where: { invigilatorId: { not: null } },
    data: { invigilatorId: null },
  });
  await prisma.invigilation.updateMany({
    where: { replacementId: { not: null } },
    data: { replacementId: null },
  });

  // Delete VenueAssignments (invigilatorId references users)
  const vaDeleted = await prisma.venueAssignment.deleteMany({});
  console.log(`  Deleted ${vaDeleted.count} venue assignments.`);

  // Delete VenueScans (userId references users)
  const vsDeleted = await prisma.venueScan.deleteMany({});
  console.log(`  Deleted ${vsDeleted.count} venue scans.`);

  // Delete Attendance records
  const attDeleted = await prisma.attendance.deleteMany({});
  console.log(`  Deleted ${attDeleted.count} attendance records.`);

  // Delete Notifications for non-admin users
  const notifDeleted = await prisma.notification.deleteMany({
    where: { user: { role: { not: 'SUPER_ADMIN' } } },
  });
  console.log(`  Deleted ${notifDeleted.count} notifications.`);

  // Delete AuditLogs by non-admin users
  const auditDeleted = await prisma.auditLog.deleteMany({
    where: { actor: { role: { not: 'SUPER_ADMIN' } } },
  });
  console.log(`  Deleted ${auditDeleted.count} audit logs.`);

  // Now delete all non-super-admin users
  const usersDeleted = await prisma.user.deleteMany({
    where: { role: { not: 'SUPER_ADMIN' } },
  });
  console.log(`  Deleted ${usersDeleted.count} users (all non-super-admin).`);

  // 2. Get the super admin
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (!superAdmin) throw new Error('No SUPER_ADMIN found!');

  // 3. Get all departments that have courses
  const departments = await prisma.department.findMany({
    where: { courses: { some: {} } },
    select: {
      id: true, name: true, code: true,
      _count: { select: { courses: true } },
    },
    orderBy: { name: 'asc' },
  });
  console.log(`\nFound ${departments.length} departments with courses.`);

  // 4. Create one department head per department
  const headPassword = await bcrypt.hash('Head@2026', 10);
  const deptHeads = [];
  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const email = `head.${dept.code.toLowerCase()}@uenr.edu.gh`;
    const staffId = `DH-${String(i + 1).padStart(3, '0')}`;
    const fullName = `Head, ${dept.name.replace(/^Department of /, '')}`;

    const head = await prisma.user.create({
      data: {
        email,
        passwordHash: headPassword,
        fullName,
        staffId,
        role: 'DEPARTMENT_HEAD',
        status: 'ACTIVE',
        departmentId: dept.id,
        departmentName: dept.name,
        approvedAt: new Date(),
        approvedById: superAdmin.id,
      },
    });
    deptHeads.push(head);
    console.log(`  Created dept head: ${fullName} (${email}) — ${dept._count.courses} courses`);
  }

  // 5. Create invigilators — spread across departments
  const invigPassword = await bcrypt.hash('Invigilator@2026', 10);
  const invigilators = [];
  for (let i = 0; i < INVIGILATOR_NAMES.length; i++) {
    const name = INVIGILATOR_NAMES[i];
    const dept = departments[i % departments.length];
    const email = `${name.toLowerCase().replace(/[^a-z]/g, '.')}.${i + 1}@uenr.edu.gh`;
    const staffId = `INV-${String(i + 1).padStart(3, '0')}`;

    const invig = await prisma.user.create({
      data: {
        email,
        passwordHash: invigPassword,
        fullName: name,
        staffId,
        role: 'INVIGILATOR',
        status: 'ACTIVE',
        departmentId: dept.id,
        departmentName: dept.name,
        approvedAt: new Date(),
        approvedById: superAdmin.id,
      },
    });
    invigilators.push(invig);
  }
  console.log(`\nCreated ${invigilators.length} invigilators (password: Invigilator@2026).`);

  // 6. Update courses to point to new department heads as creators
  for (const head of deptHeads) {
    await prisma.course.updateMany({
      where: { departmentId: head.departmentId, createdById: null },
      data: { createdById: head.id },
    });
  }
  // For any courses still without a creator, set to super admin
  await prisma.course.updateMany({
    where: { createdById: null },
    data: { createdById: superAdmin.id },
  });
  console.log('Updated course creators to new department heads.');

  console.log('\n=== Summary ===');
  console.log(`  ${deptHeads.length} department heads (password: Head@2026)`);
  console.log(`  ${invigilators.length} invigilators (password: Invigilator@2026)`);
  console.log(`  Demo invigilator removed.`);
  console.log('  Courses and departments preserved.');
}

main()
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
