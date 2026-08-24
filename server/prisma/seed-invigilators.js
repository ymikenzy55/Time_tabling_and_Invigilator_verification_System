/**
 * Seed script: Creates 10 department heads + departments, 50 invigilators,
 * 8 courses per level (100-400) with cross-department shared courses and practicals,
 * and 100 venues. No timetable is generated.
 *
 * Run with: node --env-file=.env server/prisma/seed-invigilators.js
 *
 * Prerequisites:
 *   - An active academic year + "First Semester" exists (or will be created)
 *   - A SUPER_ADMIN user exists
 *   - A faculty exists (or one will be created)
 *
 * The script is idempotent — running it twice won't create duplicates.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Batch-create notifications for all SUPER_ADMIN users. */
async function notifyExamOfficerBatch(notifications) {
  if (!notifications.length) return;
  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  if (!admins.length) return;
  const rows = [];
  for (const n of notifications) {
    for (const a of admins) {
      rows.push({
        userId: a.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: n.link || null,
        data: n.data || undefined,
      });
    }
  }
  // Batch insert in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    await prisma.notification.createMany({ data: rows.slice(i, i + 100) }).catch(() => {});
  }
}

const DEPARTMENTS = [
  { name: 'Computer Science', code: 'CSC' },
  { name: 'Electrical Engineering', code: 'EEE' },
  { name: 'Mechanical Engineering', code: 'MEE' },
  { name: 'Civil Engineering', code: 'CIE' },
  { name: 'Chemical Engineering', code: 'CHE' },
  { name: 'Mathematics', code: 'MAT' },
  { name: 'Physics', code: 'PHY' },
  { name: 'Biological Sciences', code: 'BIO' },
  { name: 'Statistics', code: 'STA' },
  { name: 'Information Technology', code: 'IT' },
];

const INSTRUCTOR_NAMES = [
  'Dr. A. Mensah', 'Prof. K. Owusu', 'Dr. B. Asante', 'Prof. M. Boateng',
  'Dr. C. Appiah', 'Prof. N. Adjei', 'Dr. D. Tetteh', 'Prof. E. Mensah',
  'Dr. F. Sarpong', 'Prof. G. Asare', 'Dr. H. Osei', 'Prof. I. Antwi',
  'Dr. J. Bonsu', 'Prof. L. Quaye', 'Dr. P. Cudjoe', 'Prof. Q. Fosu',
  'Dr. R. Adjei', 'Prof. S. Nyarko', 'Dr. T. Amoah', 'Prof. U. Danso',
  'Dr. V. Asabere', 'Prof. W. Koomson', 'Dr. X. Yeboah', 'Prof. Y. Agyei',
  'Dr. Z. Larbi', 'Prof. A. Karikari', 'Dr. B. Frimpong', 'Prof. C. Dapaah',
  'Dr. D. Asiamah', 'Prof. E. Tandoh', 'Dr. F. Boakye', 'Prof. G. Agyeman',
  'Dr. H. Darko', 'Prof. I. Baiden', 'Dr. J. Owusu-Dankwa', 'Prof. K. Asante',
  'Dr. L. Tetteh', 'Prof. M. Ankomah', 'Dr. N. Bonsu', 'Prof. O. Peprah',
];

const STUDENT_COUNTS = [45, 60, 80, 120, 50, 75, 90, 100, 55, 65, 70, 85, 40, 110, 95, 130, 35, 50, 75, 100];

const COURSE_TITLES = {
  100: [
    'Introduction to Computing', 'Calculus I', 'Linear Algebra I', 'Physics for Scientists',
    'Communication Skills', 'Engineering Drawing', 'General Chemistry', 'Workshop Practice',
  ],
  200: [
    'Data Structures', 'Circuit Theory', 'Engineering Mechanics', 'Strength of Materials',
    'Thermodynamics', 'Discrete Mathematics', 'Statistics and Probability', 'Technical Writing',
  ],
  300: [
    'Software Engineering', 'Database Systems', 'Operating Systems', 'Control Systems',
    'Signals and Systems', 'Numerical Methods', 'Research Methods', 'Project Management',
  ],
  400: [
    'Final Year Project', 'Artificial Intelligence', 'Distributed Systems', 'Network Security',
    'Cloud Computing', 'Machine Learning', 'Renewable Energy Systems', 'Robotics',
  ],
};

// Cross-department shared courses (same course title, different departments, different student groups)
const SHARED_COURSES = [
  { title: 'Engineering Mathematics I', level: 100, code: 'MATH101' },
  { title: 'Engineering Mathematics II', level: 200, code: 'MATH201' },
  { title: 'Engineering Mathematics III', level: 300, code: 'MATH301' },
  { title: 'Technical Communication', level: 200, code: 'COMM201' },
  { title: 'Research Methods', level: 300, code: 'RES301' },
  { title: 'Project Management', level: 400, code: 'PM401' },
];

// Practical courses per department — one per level (4 levels)
const PRACTICAL_COURSES = [
  ['Programming Lab I', 'Programming Lab II', 'Software Dev Lab', 'Final Project Lab'],           // CSC
  ['Circuits Lab I', 'Electronics Lab', 'Power Systems Lab', 'Electrical Design Lab'],           // EEE
  ['Mech Workshop I', 'Thermodynamics Lab', 'CAD/CAM Lab', 'Mechanical Design Lab'],            // MEE
  ['Surveying Lab I', 'Materials Lab', 'Structures Lab', 'Civil Design Lab'],                    // CIE
  ['Chem Lab I', 'Unit Operations Lab', 'Process Control Lab', 'Chemical Design Lab'],           // CHE
  ['Physics Lab I', 'Optics Lab', 'Electronics Lab', 'Advanced Physics Lab'],                    // PHY
  ['Bio Lab I', 'Microbiology Lab', 'Genetics Lab', 'Biochemistry Lab'],                         // BIO
  ['Stats Computing Lab I', 'Data Analysis Lab', 'Statistical Modeling Lab', 'Research Stats Lab'], // STA
  ['IT Lab I', 'Systems Lab', 'Security Lab', 'Network Design Lab'],                             // IT
  ['Math Lab I', 'Numerical Analysis Lab', 'Modeling Lab', 'Applied Math Lab'],                  // MAT
];

const INVIGILATOR_FIRST_NAMES = [
  'Kwame', 'Ama', 'Yaw', 'Akosua', 'Kofi', 'Adwoa', 'Kwabena', 'Abena', 'Kwesi', 'Akua',
  'Yaw', 'Afia', 'Kojo', 'Esi', 'Kwaku', 'Yaa', 'Nana', 'Akwele', 'Ekow', 'Ama',
  'Kwabena', 'Adwoa', 'Kofi', 'Abena', 'Kwame', 'Akosua', 'Kwesi', 'Afia', 'Kojo', 'Esi',
  'Nana', 'Yaa', 'Ekow', 'Akwele', 'Yaw', 'Akua', 'Kwaku', 'Adwoa', 'Kwabena', 'Abena',
  'Kwame', 'Ama', 'Kofi', 'Akosua', 'Kwesi', 'Yaa', 'Kojo', 'Esi', 'Nana', 'Akua',
];

const INVIGILATOR_LAST_NAMES = [
  'Mensah', 'Owusu', 'Asante', 'Boateng', 'Appiah', 'Adjei', 'Tetteh', 'Sarpong',
  'Asare', 'Osei', 'Antwi', 'Bonsu', 'Quaye', 'Cudjoe', 'Fosu', 'Nyarko',
  'Amoah', 'Danso', 'Asabere', 'Koomson', 'Yeboah', 'Agyei', 'Larbi', 'Karikari',
  'Frimpong', 'Dapaah', 'Asiamah', 'Tandoh', 'Boakye', 'Agyeman', 'Darko', 'Baiden',
  'Owusu-Dankwa', 'Ankomah', 'Peprah', 'Acheampong', 'Bediako', 'Fynn', 'Adjei', 'Otoo',
  'Poku', 'Asiedu', 'Donkor', 'Frimpong', 'Mensah', 'Owusu', 'Asante', 'Boateng',
  'Appiah', 'Adjei',
];

function codeFor(deptCode, level, index) {
  const prefix = deptCode.substring(0, 3);
  return `${prefix} ${level}${String(index + 1).padStart(2, '0')}`;
}

async function main() {
  console.log('[seed-invigilators] Starting...');

  // 1. Find or create a faculty
  let faculty = await prisma.faculty.findFirst({ where: { code: 'FOS' } });
  if (!faculty) {
    faculty = await prisma.faculty.create({
      data: { name: 'Faculty of Sciences', code: 'FOS' },
    });
    console.log(`[seed-invigilators] Created faculty: ${faculty.name}`);
  } else {
    console.log(`[seed-invigilators] Using existing faculty: ${faculty.name}`);
  }

  // 2. Find or create an active academic year
  let academicYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!academicYear) {
    const year = new Date().getFullYear();
    academicYear = await prisma.academicYear.create({
      data: {
        name: `${year}/${year + 1}`,
        startDate: new Date(`${year}-09-01`),
        endDate: new Date(`${year + 1}-08-31`),
        isActive: true,
      },
    });
    console.log(`[seed-invigilators] Created academic year: ${academicYear.name}`);
  } else {
    console.log(`[seed-invigilators] Using existing academic year: ${academicYear.name}`);
  }

  // 3. Find or create "First Semester"
  let semester = await prisma.semester.findFirst({
    where: { academicYearId: academicYear.id, name: { contains: 'First', mode: 'insensitive' } },
  });
  if (!semester) {
    const year = new Date(academicYear.startDate).getFullYear();
    semester = await prisma.semester.create({
      data: {
        name: 'First Semester',
        academicYearId: academicYear.id,
        startDate: new Date(`${year}-09-01`),
        endDate: new Date(`${year}-12-31`),
        isActive: true,
      },
    });
    console.log(`[seed-invigilators] Created semester: ${semester.name}`);
  } else {
    console.log(`[seed-invigilators] Using existing semester: ${semester.name}`);
  }

  // 4. Find the super admin
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
  });
  if (!superAdmin) {
    throw new Error('No active SUPER_ADMIN found. Run the main seed first to create one.');
  }

  const passwordHash = await bcrypt.hash('Invigilator@2026', 10);

  // 5. Fetch all existing data in bulk to avoid connection timeouts
  console.log('[seed-invigilators] Fetching existing data...');
  const [existingDepts, existingHeads, existingCourses, existingInvigilators, existingVenues, existingLevels] = await Promise.all([
    prisma.department.findMany({ where: { code: { in: DEPARTMENTS.map(d => d.code) } } }),
    prisma.user.findMany({ where: { email: { contains: 'dept.head.' } } }),
    prisma.course.findMany({ where: { semesterId: semester.id } }),
    prisma.user.findMany({ where: { role: 'INVIGILATOR', email: { contains: '@uenr.edu.gh' } } }),
    prisma.venue.findMany(),
    prisma.courseLevel.findMany(),
  ]);

  const deptByCode = new Map(existingDepts.map(d => [d.code, d]));
  const headByEmail = new Map(existingHeads.map(h => [h.email, h]));
  const courseByKey = new Map(existingCourses.map(c => [`${c.code}::${c.semesterId}`, c]));
  const invigilatorByEmail = new Map(existingInvigilators.map(i => [i.email, i]));
  const venueByName = new Map(existingVenues.map(v => [v.name, v]));
  const levelByDept = new Set(existingLevels.map(l => `${l.departmentId}:${l.value}`));

  const pendingNotifications = [];
  const createdDepartments = [];
  const createdDeptHeads = [];
  const coursesToCreate = [];
  const levelsToCreate = [];
  let instructorIdx = 0;
  let studentIdx = 0;

  // 6. Create missing departments
  for (let d = 0; d < DEPARTMENTS.length; d++) {
    const deptData = DEPARTMENTS[d];
    let department = deptByCode.get(deptData.code);
    if (!department) {
      department = await prisma.department.create({
        data: { name: deptData.name, code: deptData.code, facultyId: faculty.id },
      });
      console.log(`[seed-invigilators] Created department: ${department.name} (${department.code})`);
    }
    createdDepartments.push(department);

    // Queue course levels
    for (const level of [100, 200, 300, 400]) {
      if (!levelByDept.has(`${department.id}:${level}`)) {
        levelsToCreate.push({ departmentId: department.id, value: level, label: `Level ${level}` });
        levelByDept.add(`${department.id}:${level}`);
      }
    }

    // Create department head
    const headEmail = `dept.head.${deptData.code.toLowerCase()}@uenr.edu.gh`;
    let deptHead = headByEmail.get(headEmail);
    if (!deptHead) {
      deptHead = await prisma.user.create({
        data: {
          email: headEmail,
          passwordHash: await bcrypt.hash('Head@2026', 10),
          fullName: `Dr. ${INVIGILATOR_LAST_NAMES[d]} ${INVIGILATOR_LAST_NAMES[d + 10]}`,
          staffId: `DH-${String(d + 1).padStart(3, '0')}`,
          role: 'DEPARTMENT_HEAD',
          status: 'ACTIVE',
          departmentId: department.id,
          departmentName: department.name,
          approvedAt: new Date(),
        },
      });
      console.log(`[seed-invigilators] Created department head: ${deptHead.fullName} for ${department.name}`);
      pendingNotifications.push({
        type: 'APPROVAL_PENDING',
        title: 'New department head registered',
        message: `${deptHead.fullName} (${headEmail}) has been set up as head of ${department.name} and is awaiting review.`,
        link: '/department-heads',
        data: { userId: deptHead.id, departmentId: department.id },
      });
    }
    createdDeptHeads.push(deptHead);

    // Queue 8 courses per level
    for (const level of [100, 200, 300, 400]) {
      const titles = COURSE_TITLES[level];
      for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        const code = codeFor(deptData.code, level, i);
        const isPractical = i === 7;
        const levelIdx = [100, 200, 300, 400].indexOf(level);
        const practicalTitle = isPractical ? PRACTICAL_COURSES[d][levelIdx] : title;
        const courseKey = `${code}::${semester.id}`;

        if (courseByKey.has(courseKey)) {
          instructorIdx++;
          studentIdx++;
          continue;
        }

        coursesToCreate.push({
          code,
          title: isPractical ? practicalTitle : title,
          departmentId: department.id,
          semesterId: semester.id,
          level,
          creditHours: isPractical ? 2 : 3,
          studentCount: STUDENT_COUNTS[studentIdx % STUDENT_COUNTS.length],
          examDurationMinutes: isPractical ? 180 : 120,
          instructorName: INSTRUCTOR_NAMES[instructorIdx % INSTRUCTOR_NAMES.length],
          isPractical,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          createdById: deptHead.id,
        });
        pendingNotifications.push({
          type: 'COURSE_SUBMITTED',
          title: 'Course submitted for approval',
          message: `${code} — ${isPractical ? practicalTitle : title} was submitted by ${deptHead.fullName} (${department.name}).`,
          link: '/course-approvals',
          data: { courseCode: code, departmentId: department.id },
        });
        instructorIdx++;
        studentIdx++;
      }
    }
  }

  // 7. Queue cross-department shared courses
  console.log('[seed-invigilators] Queuing cross-department shared courses...');
  for (const shared of SHARED_COURSES) {
    for (let d = 0; d < createdDepartments.length; d++) {
      const dept = createdDepartments[d];
      const code = `${shared.code}-${dept.code}`;
      const courseKey = `${code}::${semester.id}`;
      if (courseByKey.has(courseKey)) continue;

      coursesToCreate.push({
        code,
        title: shared.title,
        departmentId: dept.id,
        semesterId: semester.id,
        level: shared.level,
        creditHours: 3,
        studentCount: STUDENT_COUNTS[(d * 3) % STUDENT_COUNTS.length],
        examDurationMinutes: 120,
        instructorName: INSTRUCTOR_NAMES[(d * 2) % INSTRUCTOR_NAMES.length],
        isPractical: false,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        createdById: createdDeptHeads[d]?.id || superAdmin.id,
      });
      pendingNotifications.push({
        type: 'COURSE_SUBMITTED',
        title: 'Shared course submitted for approval',
        message: `${code} — ${shared.title} was submitted for ${dept.name}.`,
        link: '/course-approvals',
        data: { courseCode: code, departmentId: dept.id },
      });
    }
  }

  // 8. Bulk create course levels
  if (levelsToCreate.length) {
    await prisma.courseLevel.createMany({ data: levelsToCreate }).catch(() => {});
    console.log(`[seed-invigilators] Created ${levelsToCreate.length} course levels.`);
  }

  // 9. Bulk create courses in chunks
  if (coursesToCreate.length) {
    for (let i = 0; i < coursesToCreate.length; i += 50) {
      await prisma.course.createMany({ data: coursesToCreate.slice(i, i + 50) });
    }
    console.log(`[seed-invigilators] Created ${coursesToCreate.length} courses.`);
  }

  // 10. Create 50 invigilators
  console.log('[seed-invigilators] Creating 50 invigilators...');
  const invigilatorsToCreate = [];
  let invigilatorCount = 0;
  for (let i = 0; i < 50; i++) {
    const firstName = INVIGILATOR_FIRST_NAMES[i];
    const lastName = INVIGILATOR_LAST_NAMES[i];
    const fullName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i + 1}@uenr.edu.gh`;
    const staffId = `INV-${String(i + 1).padStart(3, '0')}`;
    const dept = createdDepartments[i % createdDepartments.length];

    if (invigilatorByEmail.has(email)) {
      invigilatorCount++;
      continue;
    }

    invigilatorsToCreate.push({
      email,
      passwordHash,
      fullName,
      staffId,
      role: 'INVIGILATOR',
      status: 'ACTIVE',
      departmentId: dept.id,
      departmentName: dept.name,
      approvedAt: new Date(),
      approvedById: superAdmin.id,
    });
    pendingNotifications.push({
      type: 'APPROVAL_PENDING',
      title: 'New invigilator registered',
      message: `${fullName} (${email}) has been added as an invigilator for ${dept.name}.`,
      link: '/invigilators',
      data: { email, departmentId: dept.id },
    });
    invigilatorCount++;
  }
  if (invigilatorsToCreate.length) {
    for (let i = 0; i < invigilatorsToCreate.length; i += 50) {
      await prisma.user.createMany({ data: invigilatorsToCreate.slice(i, i + 50) });
    }
  }
  console.log(`[seed-invigilators] Created ${invigilatorCount} invigilators.`);

  // 11. Create 100 venues
  console.log('[seed-invigilators] Creating 100 venues...');
  const VENUE_PREFIXES = ['Auditorium', 'Lecture Hall', 'Examination Hall', 'Classroom Block', 'Lab Room', 'Seminar Room'];
  const VENUE_LOCATIONS = ['Main Campus', 'North Campus', 'South Campus', 'East Wing', 'West Wing', 'Central Block'];
  const venuesToCreate = [];
  let venueCount = 0;
  for (let i = 0; i < 100; i++) {
    const prefix = VENUE_PREFIXES[i % VENUE_PREFIXES.length];
    const num = i + 1;
    const name = `${prefix} ${num}`;
    if (venueByName.has(name)) {
      venueCount++;
      continue;
    }
    venuesToCreate.push({
      name,
      capacity: [50, 100, 150, 200, 250, 300, 350, 400][(i % 8)],
      location: VENUE_LOCATIONS[i % VENUE_LOCATIONS.length],
      isActive: true,
    });
    venueCount++;
  }
  if (venuesToCreate.length) {
    for (let i = 0; i < venuesToCreate.length; i += 50) {
      await prisma.venue.createMany({ data: venuesToCreate.slice(i, i + 50) });
    }
  }
  console.log(`[seed-invigilators] Created ${venueCount} venues.`);

  // 12. Batch create all notifications
  console.log(`[seed-invigilators] Creating ${pendingNotifications.length} notifications...`);
  await notifyExamOfficerBatch(pendingNotifications);

  console.log('\n[seed-invigilators] Summary:');
  console.log(`  - ${createdDepartments.length} departments with department heads`);
  console.log(`  - ${coursesToCreate.length} new courses created (8 per level, 4 levels + shared courses)`);
  console.log(`  - ${invigilatorCount} invigilators (password: Invigilator@2026)`);
  console.log(`  - ${venueCount} venues`);
  console.log(`  - ${pendingNotifications.length} notifications sent to exam officer`);
  console.log('  - All courses are SUBMITTED and awaiting exam officer approval');
  console.log('  - No timetable created — approve courses first, then use the Timetable page to generate one.');
}

main()
  .catch((err) => {
    console.error('[seed-invigilators] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
