/**
 * One-time seed from uenr_timetable_seed_clean.xlsx (converted to seed-data.json).
 *
 * For every department in the sheet:
 *  - upserts the Department (matched case-insensitively by name)
 *  - ensures CourseLevel rows for every level present in the sheet
 *  - ensures one Department Head and one Invigilator account exist
 *    (reuses existing users already linked to the department)
 *  - creates the department's courses with status SUBMITTED so they land
 *    in the Exam Officer's approval queue
 *
 * Rows without a department are assigned to "General Studies".
 * Existing courses (same code + semester) are skipped — safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HEAD_PASSWORD = 'Head@2026';
const INVIG_PASSWORD = 'Invig@2026';
const GENERAL_DEPT_NAME = 'General Studies';

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));

const normalizeName = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : null);

const buildCode = (name) => {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .filter((w) => !['OF', 'AND', 'THE', 'DEPARTMENT'].includes(w))
    .map((part) => part.slice(0, 3))
    .join('')
    .slice(0, 8);
  return cleaned.length >= 2 ? cleaned : `DEPT${Math.random().toString(36).toUpperCase().slice(-4)}`;
};

const slugify = (name) => name
  .toLowerCase()
  .replace(/^department of\s+/i, '')
  .replace(/[^a-z0-9]+/g, '.')
  .replace(/^\.+|\.+$/g, '')
  .split('.')
  .filter(Boolean)
  .slice(0, 3)
  .join('.');

async function ensureSemester() {
  let semester = await prisma.semester.findFirst({ where: { isActive: true }, include: { academicYear: true } });
  if (semester) return semester;

  semester = await prisma.semester.findFirst({ orderBy: { startDate: 'desc' }, include: { academicYear: true } });
  if (semester) return semester;

  let year = await prisma.academicYear.findFirst({ where: { name: '2026/2027' } });
  if (!year) {
    year = await prisma.academicYear.create({
      data: {
        name: '2026/2027',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-08-31'),
        isActive: true,
      },
    });
  }
  return prisma.semester.create({
    data: {
      name: 'First Semester',
      academicYearId: year.id,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-01-31'),
      isActive: true,
    },
    include: { academicYear: true },
  });
}

async function ensureDepartment(name) {
  const existing = await prisma.department.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing;

  let code = buildCode(name);
  let attempt = 1;
  while (await prisma.department.findUnique({ where: { code } })) {
    attempt += 1;
    code = `${buildCode(name)}${attempt}`.slice(0, 10);
  }
  return prisma.department.create({ data: { name, code } });
}

async function ensureUser({ role, department, email, fullName, staffId, password }) {
  // Reuse any existing user of this role already linked to the department
  const linked = await prisma.user.findFirst({
    where: { role, departmentId: department.id },
  });
  if (linked) {
    console.log(`  [reuse] ${role} for ${department.name}: ${linked.email}`);
    return linked;
  }

  // Reuse by email if it exists (re-run safety)
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.departmentId !== department.id) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { departmentId: department.id, departmentName: department.name },
      });
    }
    console.log(`  [reuse] ${role} by email: ${email}`);
    return byEmail;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let finalStaffId = staffId;
  let n = 1;
  while (await prisma.user.findUnique({ where: { staffId: finalStaffId } })) {
    n += 1;
    finalStaffId = `${staffId}-${n}`;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      staffId: finalStaffId,
      role,
      status: 'ACTIVE',
      departmentId: department.id,
      departmentName: department.name,
      approvedAt: new Date(),
    },
  });
  console.log(`  [create] ${role}: ${email} / ${password} (staffId: ${finalStaffId})`);
  return user;
}

async function main() {
  const semester = await ensureSemester();
  console.log(`[seed] Using semester: ${semester.name} (${semester.academicYear?.name || ''})`);

  // Group rows by department
  const byDept = new Map();
  for (const row of rows) {
    const deptName = normalizeName(row.department) || GENERAL_DEPT_NAME;
    if (!byDept.has(deptName)) byDept.set(deptName, []);
    byDept.get(deptName).push(row);
  }

  let totalCourses = 0;
  let skippedCourses = 0;
  const credentials = [];

  for (const [deptName, deptRows] of byDept.entries()) {
    console.log(`\n[dept] ${deptName} (${deptRows.length} courses)`);
    const department = await ensureDepartment(deptName);

    // Course levels
    const levels = [...new Set(deptRows.map((r) => parseInt(r.level, 10)).filter((l) => !Number.isNaN(l)))];
    for (const value of levels) {
      await prisma.courseLevel.upsert({
        where: { departmentId_value: { departmentId: department.id, value } },
        update: {},
        create: { departmentId: department.id, value, label: `Level ${value}` },
      });
    }

    // Users
    const slug = slugify(deptName) || department.code.toLowerCase();
    const head = await ensureUser({
      role: 'DEPARTMENT_HEAD',
      department,
      email: `head.${slug}@uenr.edu.gh`,
      fullName: `Head, ${deptName.replace(/^Department of\s+/i, '')}`,
      staffId: `DH-${department.code}`,
      password: HEAD_PASSWORD,
    });
    const invig = await ensureUser({
      role: 'INVIGILATOR',
      department,
      email: `invig.${slug}@uenr.edu.gh`,
      fullName: `Invigilator, ${deptName.replace(/^Department of\s+/i, '')}`,
      staffId: `INV-${department.code}`,
      password: INVIG_PASSWORD,
    });
    credentials.push({ department: deptName, headEmail: head.email, invigilatorEmail: invig.email });

    // Courses — SUBMITTED so they reach the Exam Officer's approval queue
    for (const row of deptRows) {
      const code = String(row.course_code || '').trim();
      const title = String(row.course_name || '').trim();
      if (!code || !title) { skippedCourses += 1; continue; }

      const existing = await prisma.course.findUnique({
        where: { code_semesterId: { code, semesterId: semester.id } },
      });
      if (existing) { skippedCourses += 1; continue; }

      const level = parseInt(row.level, 10) || 100;
      const special = [];
      if (row.venue) special.push(`Preferred venue: ${row.venue}`);
      if (row.is_general === true) special.push('General course');

      await prisma.course.create({
        data: {
          code,
          title,
          departmentId: department.id,
          level,
          semesterId: semester.id,
          creditHours: 3,
          studentCount: parseInt(row.student_count, 10) || 0,
          examDurationMinutes: parseInt(row.duration, 10) || 180,
          instructorName: row.lecturer ? String(row.lecturer).trim() : null,
          isPractical: String(row.exam_type || '').toLowerCase() === 'practical',
          specialRequirements: special.length ? special.join(' | ') : null,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          createdById: head.id,
        },
      });
      totalCourses += 1;
    }
  }

  console.log(`\n[seed] Done. Courses created: ${totalCourses}, skipped (existing/invalid): ${skippedCourses}`);
  console.log(`[seed] Departments processed: ${byDept.size}`);
  console.log(`[seed] Department Head password: ${HEAD_PASSWORD}`);
  console.log(`[seed] Invigilator password: ${INVIG_PASSWORD}`);
  console.table(credentials);
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
