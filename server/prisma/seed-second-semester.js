/**
 * Seed script: Creates courses for Second Semester
 * - 7 courses per level (100-300) = 21 credit hours
 * - 6 courses for level 400 = 18 credit hours
 * - All submitted for exam officer approval
 *
 * Run with: node --env-file=.env server/prisma/seed-second-semester.js
 *
 * Prerequisites:
 *   - An active academic year exists
 *   - A "Second Semester" exists under that academic year
 *   - A faculty exists
 *   - A SUPER_ADMIN user exists
 *
 * The script is idempotent — running it twice won't create duplicates.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: 'Computer Engineering', code: 'CPE',
    courses: {
      100: ['Introduction to Computing II', 'Computer Programming II', 'Digital Logic Design II', 'Engineering Mathematics III', 'Technical Writing', 'Communication Skills II', 'Basic Electronics'],
      200: ['Data Structures II', 'Computer Architecture II', 'Discrete Mathematics II', 'Operating Systems II', 'Circuit Analysis II', 'Engineering Mathematics IV', 'Electronics I'],
      300: ['Software Engineering II', 'Database Systems II', 'Computer Networks II', 'Microprocessors II', 'Signals and Systems II', 'Algorithms and Complexity II', 'Embedded Systems I'],
      400: ['Final Year Project II', 'Distributed Systems II', 'Artificial Intelligence II', 'Network Security II', 'Embedded Systems II', 'Cloud Computing II'],
    },
  },
  { name: 'Electrical Engineering', code: 'EEE',
    courses: {
      100: ['Introduction to Electrical Engineering II', 'Circuit Theory III', 'Engineering Drawing II', 'Engineering Mathematics III', 'Physics for Engineers II', 'Workshop Practice II', 'Basic Electronics'],
      200: ['Circuit Theory IV', 'Electronics III', 'Electromagnetic Fields II', 'Engineering Mathematics IV', 'Thermodynamics II', 'Materials Science II', 'Digital Electronics'],
      300: ['Power Systems III', 'Control Systems II', 'Electronics IV', 'Digital Signal Processing II', 'Electrical Machines II', 'Communication Systems II', 'Power Electronics I'],
      400: ['Power Systems IV', 'Renewable Energy Systems II', 'Final Year Project II', 'Instrumentation and Control II', 'High Voltage Engineering II', 'Power Electronics II'],
    },
  },
  { name: 'Mechanical Engineering', code: 'MEE',
    courses: {
      100: ['Introduction to Mechanical Engineering II', 'Engineering Mechanics III', 'Engineering Drawing II', 'Engineering Mathematics III', 'Thermodynamics III', 'Workshop Technology II', 'Basic Mechanics'],
      200: ['Engineering Mechanics IV', 'Strength of Materials II', 'Fluid Mechanics III', 'Engineering Mathematics IV', 'Materials Science II', 'Machine Drawing II', 'Manufacturing Processes'],
      300: ['Thermodynamics IV', 'Heat Transfer II', 'Fluid Mechanics IV', 'Machine Design III', 'Manufacturing Technology II', 'Engineering Economics II', 'Mechatronics I'],
      400: ['Machine Design IV', 'Final Year Project II', 'Robotics II', 'Automotive Engineering II', 'HVAC Systems II', 'Production Management II'],
    },
  },
  { name: 'Civil Engineering', code: 'CIE',
    courses: {
      100: ['Introduction to Civil Engineering II', 'Engineering Mechanics III', 'Engineering Drawing II', 'Engineering Mathematics III', 'Geology for Engineers II', 'Surveying III', 'Basic Civil Engineering'],
      200: ['Strength of Materials II', 'Fluid Mechanics III', 'Engineering Mathematics IV', 'Structural Analysis III', 'Construction Materials II', 'Surveying IV', 'Concrete Technology'],
      300: ['Structural Analysis IV', 'Geotechnical Engineering II', 'Hydraulics II', 'Reinforced Concrete Design II', 'Transportation Engineering II', 'Environmental Engineering II', 'Steel Structures I'],
      400: ['Steel Design II', 'Final Year Project II', 'Water Resources Engineering II', 'Construction Management II', 'Foundation Engineering II', 'Highway Engineering II'],
    },
  },
  { name: 'Chemical Engineering', code: 'CHE',
    courses: {
      100: ['Introduction to Chemical Engineering II', 'General Chemistry II', 'Engineering Mathematics III', 'Engineering Drawing II', 'Organic Chemistry II', 'Physics for Engineers II', 'Basic Chemical Engineering'],
      200: ['Chemical Engineering Principles III', 'Physical Chemistry II', 'Engineering Mathematics IV', 'Analytical Chemistry II', 'Material and Energy Balances II', 'Thermodynamics III', 'Unit Operations I'],
      300: ['Chemical Engineering Principles IV', 'Heat Transfer II', 'Mass Transfer II', 'Reaction Engineering II', 'Process Control II', 'Chemical Process Safety II', 'Unit Operations II'],
      400: ['Process Design II', 'Final Year Project II', 'Petroleum Refining II', 'Polymer Engineering II', 'Biochemical Engineering II', 'Environmental Chemical Engineering II'],
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
  console.log('[seed-second-semester] Starting...');

  // 1. Find or create a faculty
  let faculty = await prisma.faculty.findFirst({ where: { code: 'FOE' } });
  if (!faculty) {
    faculty = await prisma.faculty.create({
      data: { name: 'Faculty of Engineering', code: 'FOE' },
    });
    console.log(`[seed-second-semester] Created faculty: ${faculty.name}`);
  } else {
    console.log(`[seed-second-semester] Using existing faculty: ${faculty.name}`);
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
    console.log(`[seed-second-semester] Created academic year: ${academicYear.name}`);
  } else {
    console.log(`[seed-second-semester] Using existing academic year: ${academicYear.name}`);
  }

  // 3. Find or create "Second Semester" under the academic year
  let semester = await prisma.semester.findFirst({
    where: {
      academicYearId: academicYear.id,
      name: { contains: 'Second', mode: 'insensitive' },
    },
  });
  if (!semester) {
    const year = new Date(academicYear.startDate).getFullYear();
    semester = await prisma.semester.create({
      data: {
        name: 'Second Semester',
        academicYearId: academicYear.id,
        startDate: new Date(`${year}-02-01`),
        endDate: new Date(`${year}-06-30`),
        isActive: true,
      },
    });
    console.log(`[seed-second-semester] Created semester: ${semester.name}`);
  } else {
    console.log(`[seed-second-semester] Using existing semester: ${semester.name}`);
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
      console.log(`[seed-second-semester] Created department: ${department.name} (${department.code})`);
    } else {
      console.log(`[seed-second-semester] Using existing department: ${department.name}`);
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

  console.log(`[seed-second-semester] Done! ${totalCourses} courses across ${DEPARTMENTS.length} departments, all submitted for approval.`);
  console.log('[seed-second-semester] Log in as SUPER_ADMIN and go to Course Approvals to approve them.');
}

main()
  .catch((err) => {
    console.error('[seed-second-semester] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
