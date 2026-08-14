/**
 * Seed script: Creates 5 departments with 6 courses per level (100–400)
 * for 1st semester, all submitted for exam officer approval.
 *
 * Run with: node --env-file=.env server/prisma/seed-test-data.js
 *
 * Prerequisites:
 *   - An active academic year exists (or one will be created)
 *   - A "First Semester" exists under that academic year
 *   - A faculty exists (or one will be created)
 *   - A SUPER_ADMIN user exists to be set as the approver reference
 *
 * The script is idempotent — running it twice won't create duplicates.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: 'Computer Engineering', code: 'CPE',
    courses: {
      100: ['Introduction to Computing', 'Computer Programming', 'Digital Logic Design', 'Engineering Mathematics I', 'Technical Drawing', 'Communication Skills'],
      200: ['Data Structures', 'Computer Architecture', 'Discrete Mathematics', 'Operating Systems I', 'Circuit Analysis', 'Engineering Mathematics II'],
      300: ['Software Engineering', 'Database Systems', 'Computer Networks', 'Microprocessors', 'Signals and Systems', 'Algorithms and Complexity'],
      400: ['Final Year Project', 'Distributed Systems', 'Artificial Intelligence', 'Network Security', 'Embedded Systems', 'Cloud Computing'],
    },
  },
  { name: 'Electrical Engineering', code: 'EEE',
    courses: {
      100: ['Introduction to Electrical Engineering', 'Circuit Theory I', 'Engineering Drawing', 'Engineering Mathematics I', 'Physics for Engineers', 'Workshop Practice'],
      200: ['Circuit Theory II', 'Electronics I', 'Electromagnetic Fields', 'Engineering Mathematics II', 'Thermodynamics', 'Materials Science'],
      300: ['Power Systems I', 'Control Systems', 'Electronics II', 'Digital Signal Processing', 'Electrical Machines', 'Communication Systems'],
      400: ['Power Systems II', 'Renewable Energy Systems', 'Final Year Project', 'Instrumentation and Control', 'High Voltage Engineering', 'Power Electronics'],
    },
  },
  { name: 'Mechanical Engineering', code: 'MEE',
    courses: {
      100: ['Introduction to Mechanical Engineering', 'Engineering Mechanics I', 'Engineering Drawing', 'Engineering Mathematics I', 'Thermodynamics I', 'Workshop Technology'],
      200: ['Engineering Mechanics II', 'Strength of Materials', 'Fluid Mechanics I', 'Engineering Mathematics II', 'Materials Science', 'Machine Drawing'],
      300: ['Thermodynamics II', 'Heat Transfer', 'Fluid Mechanics II', 'Machine Design I', 'Manufacturing Technology', 'Engineering Economics'],
      400: ['Machine Design II', 'Final Year Project', 'Robotics', 'Automotive Engineering', 'HVAC Systems', 'Production Management'],
    },
  },
  { name: 'Civil Engineering', code: 'CIE',
    courses: {
      100: ['Introduction to Civil Engineering', 'Engineering Mechanics I', 'Engineering Drawing', 'Engineering Mathematics I', 'Geology for Engineers', 'Surveying I'],
      200: ['Strength of Materials', 'Fluid Mechanics I', 'Engineering Mathematics II', 'Structural Analysis I', 'Construction Materials', 'Surveying II'],
      300: ['Structural Analysis II', 'Geotechnical Engineering', 'Hydraulics', 'Reinforced Concrete Design', 'Transportation Engineering', 'Environmental Engineering'],
      400: ['Steel Design', 'Final Year Project', 'Water Resources Engineering', 'Construction Management', 'Foundation Engineering', 'Highway Engineering'],
    },
  },
  { name: 'Chemical Engineering', code: 'CHE',
    courses: {
      100: ['Introduction to Chemical Engineering', 'General Chemistry', 'Engineering Mathematics I', 'Engineering Drawing', 'Organic Chemistry', 'Physics for Engineers'],
      200: ['Chemical Engineering Principles I', 'Physical Chemistry', 'Engineering Mathematics II', 'Analytical Chemistry', 'Material and Energy Balances', 'Thermodynamics I'],
      300: ['Chemical Engineering Principles II', 'Heat Transfer', 'Mass Transfer', 'Reaction Engineering', 'Process Control', 'Chemical Process Safety'],
      400: ['Process Design', 'Final Year Project', 'Petroleum Refining', 'Polymer Engineering', 'Biochemical Engineering', 'Environmental Chemical Engineering'],
    },
  },
];

const INSTRUCTOR_NAMES = [
  'Dr. A. Mensah', 'Prof. K. Owusu', 'Dr. B. Asante', 'Prof. M. Boateng',
  'Dr. C. Appiah', 'Prof. N. Adjei', 'Dr. D. Tetteh', 'Prof. E. Mensah',
  'Dr. F. Sarpong', 'Prof. G. Asare', 'Dr. H. Osei', 'Prof. I. Antwi',
  'Dr. J. Bonsu', 'Prof. L. Quaye', 'Dr. P. Cudjoe', 'Prof. Q. Fosu',
  'Dr. R. Adjei', 'Prof. S. Nyarko', 'Dr. T. Amoah', 'Prof. U. Danso',
  'Dr. V. Asabere', 'Prof. W. Koomson', 'Dr. X. Yeboah', 'Prof. Y. Agyei',
  'Dr. Z. Larbi', 'Prof. A. Karikari', 'Dr. B. Frimpong', 'Prof. C. Dapaah',
  'Dr. D. Asiamah', 'Prof. E. Tandoh',
];

const STUDENT_COUNTS = [45, 60, 80, 120, 50, 75, 90, 100, 55, 65, 70, 85, 40, 110, 95, 130, 35, 50, 75, 100, 60, 80, 45, 120];

function codeFor(deptCode, level, index) {
  const prefix = deptCode.substring(0, 2);
  return `${prefix} ${level}${String(index + 1).padStart(2, '0')}`;
}

async function main() {
  console.log('[seed-test-data] Starting...');

  // 1. Find or create a faculty
  let faculty = await prisma.faculty.findFirst({ where: { code: 'FOE' } });
  if (!faculty) {
    faculty = await prisma.faculty.create({
      data: { name: 'Faculty of Engineering', code: 'FOE' },
    });
    console.log(`[seed-test-data] Created faculty: ${faculty.name}`);
  } else {
    console.log(`[seed-test-data] Using existing faculty: ${faculty.name}`);
  }

  // 2. Find or create an active academic year
  let academicYear = await prisma.academicYear.findFirst({
    where: { isActive: true },
  });
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
    console.log(`[seed-test-data] Created academic year: ${academicYear.name}`);
  } else {
    console.log(`[seed-test-data] Using existing academic year: ${academicYear.name}`);
  }

  // 3. Find or create "First Semester" under the academic year
  let semester = await prisma.semester.findFirst({
    where: {
      academicYearId: academicYear.id,
      name: { contains: 'First', mode: 'insensitive' },
    },
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
    console.log(`[seed-test-data] Created semester: ${semester.name}`);
  } else {
    console.log(`[seed-test-data] Using existing semester: ${semester.name}`);
  }

  // 4. Find the super admin to use as creator/approver reference
  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
  });
  if (!superAdmin) {
    throw new Error('No active SUPER_ADMIN found. Run the main seed first to create one.');
  }

  // 5. Create departments + course levels + courses
  let totalCourses = 0;
  let instructorIdx = 0;
  let studentIdx = 0;

  for (const deptData of DEPARTMENTS) {
    // Find or create department
    let department = await prisma.department.findFirst({
      where: { code: deptData.code },
    });
    if (!department) {
      department = await prisma.department.create({
        data: { name: deptData.name, code: deptData.code, facultyId: faculty.id },
      });
      console.log(`[seed-test-data] Created department: ${department.name} (${department.code})`);
    } else {
      console.log(`[seed-test-data] Using existing department: ${department.name}`);
    }

    // Create course levels 100-400 if they don't exist
    for (const level of [100, 200, 300, 400]) {
      const existingLevel = await prisma.courseLevel.findUnique({
        where: { departmentId_value: { departmentId: department.id, value: level } },
      });
      if (!existingLevel) {
        await prisma.courseLevel.create({
          data: { departmentId: department.id, value: level, label: `Level ${level}` },
        });
      }
    }

    // Create courses for each level
    for (const level of [100, 200, 300, 400]) {
      const courseTitles = deptData.courses[level];
      for (let i = 0; i < courseTitles.length; i++) {
        const code = codeFor(deptData.code, level, i);
        const title = courseTitles[i];

        // Check if course already exists (unique on code + semesterId)
        const existing = await prisma.course.findUnique({
          where: { code_semesterId: { code, semesterId: semester.id } },
        });
        if (existing) {
          // Update status to SUBMITTED if not already
          if (existing.status !== 'SUBMITTED') {
            await prisma.course.update({
              where: { id: existing.id },
              data: {
                status: 'SUBMITTED',
                submittedAt: new Date(),
                instructorName: INSTRUCTOR_NAMES[instructorIdx % INSTRUCTOR_NAMES.length],
                studentCount: STUDENT_COUNTS[studentIdx % STUDENT_COUNTS.length],
              },
            });
          }
          totalCourses++;
          instructorIdx++;
          studentIdx++;
          continue;
        }

        await prisma.course.create({
          data: {
            code,
            title,
            departmentId: department.id,
            semesterId: semester.id,
            level,
            creditHours: 3,
            studentCount: STUDENT_COUNTS[studentIdx % STUDENT_COUNTS.length],
            examDurationMinutes: 120,
            instructorName: INSTRUCTOR_NAMES[instructorIdx % INSTRUCTOR_NAMES.length],
            status: 'SUBMITTED',
            submittedAt: new Date(),
            createdById: superAdmin.id,
          },
        });
        totalCourses++;
        instructorIdx++;
        studentIdx++;
      }
    }
  }

  console.log(`[seed-test-data] Done! ${totalCourses} courses across ${DEPARTMENTS.length} departments, all submitted for approval.`);
  console.log('[seed-test-data] Log in as SUPER_ADMIN and go to Course Approvals to approve them.');
}

main()
  .catch((err) => {
    console.error('[seed-test-data] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
