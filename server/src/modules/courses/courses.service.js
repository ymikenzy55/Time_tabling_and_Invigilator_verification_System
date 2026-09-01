import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { createNotification, notifyRole } from '../notifications/notifications.service.js';
import { broadcast } from '../../utils/broadcast.js';
import { courseLevelsService } from '../courseLevels/courseLevels.service.js';
import { logAudit, logAuditBatch } from '../../utils/auditLog.js';
import { cache } from '../../utils/cache.js';
import { sendEmail } from '../../utils/email.js';
import { primaryClientOrigin } from '../../config/env.js';

const ALLOWED_SEMESTER_NAMES = new Set(['first semester', 'second semester']);

const publicSelect = {
  id: true,
  code: true,
  title: true,
  level: true,
  creditHours: true,
  studentCount: true,
  examDurationMinutes: true,
  specialRequirements: true,
  instructorName: true,
  isPractical: true,
  status: true,
  rejectionComment: true,
  locked: true,
  departmentId: true,
  semesterId: true,
  createdById: true,
  approvedById: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
  department: { select: { id: true, name: true, code: true } },
  semester: { select: { id: true, name: true, academicYear: { select: { name: true } } } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  approvedBy: { select: { id: true, fullName: true } },
};

// Lightweight select for list endpoints — drops nested User relations and
// sub-relations (academicYear) that the list table doesn't render.
// This eliminates extra Prisma queries per list call.
const listSelect = {
  id: true,
  code: true,
  title: true,
  level: true,
  creditHours: true,
  studentCount: true,
  examDurationMinutes: true,
  specialRequirements: true,
  instructorName: true,
  isPractical: true,
  status: true,
  locked: true,
  departmentId: true,
  semesterId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  department: { select: { id: true, name: true, code: true } },
  semester: { select: { id: true, name: true } },
};

const verifyCourseOwnership = async (courseId, user) => {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw ApiError.notFound('Course not found.');
  if (user.role === 'DEPARTMENT_HEAD' && course.createdById !== user.id) {
    throw ApiError.forbidden('You can only manage courses created by you.');
  }
  return course;
};

const clearCoursesCache = () => {
  cache.clearPrefix('courses:list:');
};

export const coursesService = {
  async list({ departmentId, semesterId, status, level, q } = {}, actor) {
    const targetDepartmentId = actor?.role === 'DEPARTMENT_HEAD' ? actor.departmentId : departmentId;
    if (actor?.role === 'DEPARTMENT_HEAD' && !actor.departmentId) {
      throw ApiError.forbidden('You are not assigned to a department.');
    }
    const cacheKey = `courses:list:${targetDepartmentId || 'all'}:${semesterId || 'all'}:${status || 'all'}:${level || 'all'}:${q || 'all'}`;
    return cache.remember(cacheKey, 15_000, async () =>
      prisma.course.findMany({
        where: {
          ...(targetDepartmentId ? { departmentId: targetDepartmentId } : {}),
          ...(semesterId ? { semesterId } : {}),
          ...(status ? { status } : {}),
          ...(level ? { level: Number(level) } : {}),
          ...(q ? { OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
          ]} : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: listSelect,
      })
    );
  },

  async getById(id, actor) {
    const course = await prisma.course.findUnique({ where: { id }, select: publicSelect });
    if (!course) throw ApiError.notFound('Course not found.');
    if (actor?.role === 'DEPARTMENT_HEAD' && course.departmentId !== actor.departmentId) {
      throw ApiError.forbidden('You do not have access to this course.');
    }
    return course;
  },

  async create(payload, actor) {
    let { departmentId } = payload;
    const { semesterId } = payload;

    // Department Heads always add courses under their own department — clients
    // may omit the field entirely.
    if (actor.role === 'DEPARTMENT_HEAD') {
      departmentId = actor.departmentId || departmentId;
      payload = { ...payload, departmentId };
    }

    if (!departmentId) {
      if (actor.role === 'DEPARTMENT_HEAD') {
        throw ApiError.badRequest('Your account is not linked to a department. Contact the Examination Office to continue.');
      }
      throw ApiError.badRequest('Department is required.');
    }

    const [department, semester, existing, levelExists] = await Promise.all([
      departmentId
        ? prisma.department.findUnique({ where: { id: departmentId } })
        : Promise.resolve(null),
      prisma.semester.findUnique({ where: { id: semesterId } }),
      prisma.course.findUnique({ where: { code_semesterId: { code: payload.code, semesterId } } }),
      departmentId
        ? prisma.courseLevel.findFirst({ where: { departmentId, value: payload.level } })
        : Promise.resolve(null),
    ]);

    if (departmentId && !department) throw ApiError.notFound('Department not found.');
    if (!semester) throw ApiError.notFound('Semester not found.');
    if (existing) throw ApiError.conflict('A course with this code already exists for this semester.');

    if (actor.role === 'DEPARTMENT_HEAD') {
      const normalizedSemesterName = semester.name.trim().toLowerCase();
      if (!ALLOWED_SEMESTER_NAMES.has(normalizedSemesterName)) {
        throw ApiError.badRequest('Department heads can only assign courses to First or Second Semester.');
      }
    }

    if (departmentId && !levelExists) {
      // Seed defaults only when the level is missing, then re-check.
      await courseLevelsService.ensureDefaultsForDepartment(departmentId);
      const rechecked = await prisma.courseLevel.findFirst({
        where: { departmentId, value: payload.level },
      });
      if (!rechecked) {
        throw ApiError.badRequest('This level is not available for your department. Add it first.');
      }
    }

    const sanitizedPayload = {
      ...payload,
      instructorName: payload.instructorName?.trim(),
    };

    const course = await prisma.course.create({
      data: {
        ...sanitizedPayload,
        status: 'DRAFT',
        createdById: actor.id,
      },
      select: publicSelect,
    });

    clearCoursesCache();

    logAudit({
      actorId: actor.id,
      action: 'COURSE.CREATE',
      targetType: 'Course',
      targetId: course.id,
      result: 'SUCCESS',
      metadata: { code: payload.code, title: payload.title },
    });

    return course;
  },

  async bulkImport({ semesterId, courses }, actor) {
    if (!Array.isArray(courses) || courses.length === 0) {
      throw ApiError.badRequest('No courses to import.');
    }

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) throw ApiError.notFound('Semester not found.');

    // Resolve all department names to IDs (case-insensitive)
    const deptNames = [...new Set(courses.map((c) => c.departmentName.trim().toLowerCase()))];
    const existingDepts = await prisma.department.findMany({
      where: { name: { in: deptNames, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    const deptMap = new Map(existingDepts.map((d) => [d.name.toLowerCase(), d]));

    // For any missing departments, create them automatically
    const { ensureDepartmentForName } = await import('../departments/departmentAutoLink.js');

    // De-duplicate by code within the payload
    const seenCodes = new Set();
    const unique = [];
    for (const c of courses) {
      const key = `${c.code.trim().toLowerCase()}-${semesterId}`;
      if (!seenCodes.has(key)) {
        seenCodes.add(key);
        unique.push(c);
      }
    }

    // Find existing course codes for this semester
    const existingCourses = await prisma.course.findMany({
      where: { code: { in: unique.map((c) => c.code.trim()) }, semesterId },
      select: { code: true },
    });
    const existingCodes = new Set(existingCourses.map((c) => c.code.toLowerCase()));

    const toCreate = [];
    const skipped = [];
    const deptCache = new Map();

    for (const c of unique) {
      const code = c.code.trim();
      if (existingCodes.has(code.toLowerCase())) {
        skipped.push({ code, title: c.title, reason: 'Already exists for this semester.' });
        continue;
      }

      const deptNameKey = c.departmentName.trim().toLowerCase();
      let dept = deptCache.get(deptNameKey);
      if (!dept) {
        dept = deptMap.get(deptNameKey);
        if (!dept) {
          // Create the department on the fly
          dept = await ensureDepartmentForName(prisma, c.departmentName.trim());
        }
        deptCache.set(deptNameKey, dept);
      }

      // Ensure course level exists for this department
      const levelExists = await prisma.courseLevel.findFirst({
        where: { departmentId: dept.id, value: c.level },
      });
      if (!levelExists) {
        await courseLevelsService.ensureDefaultsForDepartment(dept.id);
      }

      toCreate.push({
        code,
        title: c.title.trim(),
        departmentId: dept.id,
        semesterId,
        level: c.level,
        creditHours: c.creditHours ?? 3,
        studentCount: c.studentCount ?? 0,
        examDurationMinutes: c.examDurationMinutes ?? 180,
        instructorName: c.instructorName?.trim() || 'TBA',
        status: 'DRAFT',
        createdById: actor.id,
      });
    }

    let created = [];
    if (toCreate.length > 0) {
      created = await prisma.$transaction(
        toCreate.map((c) => prisma.course.create({ data: c, select: { id: true, code: true, title: true } }))
      );
    }

    clearCoursesCache();

    logAudit({
      actorId: actor.id,
      action: 'COURSE.BULK_IMPORT',
      targetType: 'Course',
      targetId: 'bulk',
      result: 'SUCCESS',
      metadata: { created: created.length, skipped: skipped.length, total: courses.length },
    });

    return { created: created.length, skipped: skipped.length, skippedDetails: skipped, total: courses.length };
  },

  async update(id, payload, actor) {
    const course = await verifyCourseOwnership(id, actor);
    if (course.locked) throw ApiError.forbidden('This course is locked and cannot be edited.');
    if (course.status === 'APPROVED') throw ApiError.badRequest('Approved courses cannot be edited.');

    const { departmentId, semesterId, code } = payload;
    const targetDepartmentId = departmentId || course.departmentId;
    const targetSemesterId = semesterId || course.semesterId;

    if (departmentId || semesterId) {
      const [department, semester] = await Promise.all([
        prisma.department.findUnique({ where: { id: targetDepartmentId } }),
        prisma.semester.findUnique({ where: { id: targetSemesterId } }),
      ]);
      if (!department) throw ApiError.notFound('Department not found.');
      if (!semester) throw ApiError.notFound('Semester not found.');
    }

    if (actor.role === 'DEPARTMENT_HEAD' && actor.departmentId !== targetDepartmentId) {
      throw ApiError.forbidden('You can only manage courses for your own department.');
    }

    if (code) {
      const existing = await prisma.course.findUnique({
        where: { code_semesterId: { code, semesterId: targetSemesterId } },
      });
      if (existing && existing.id !== id) {
        throw ApiError.conflict('A course with this code already exists for this semester.');
      }
    }

    const sanitizedUpdate = {
      ...payload,
      ...(payload.instructorName !== undefined
        ? { instructorName: payload.instructorName?.trim() }
        : {}),
    };

    const updated = await prisma.course.update({
      where: { id },
      data: { ...sanitizedUpdate, status: 'DRAFT', submittedAt: null },
      select: publicSelect,
    });

    clearCoursesCache();

    if (course.status === 'SUBMITTED') {
      broadcast.toRoles('SUPER_ADMIN', 'course-updated', { courseId: id });
    }
    broadcast.toUser(actor.id, 'course-updated', { courseId: id });

    logAudit({
      actorId: actor.id,
      action: 'COURSE.UPDATE',
      targetType: 'Course',
      targetId: id,
      result: 'SUCCESS',
    });

    return updated;
  },

  async submit(id, actor) {
    const course = await verifyCourseOwnership(id, actor);
    if (course.locked) throw ApiError.forbidden('This course is locked.');
    if (course.status === 'APPROVED') throw ApiError.badRequest('This course is already approved.');
    if (course.status === 'SUBMITTED') throw ApiError.badRequest('This course is already submitted.');

    const updated = await prisma.course.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      select: { id: true, code: true, title: true, status: true, createdById: true, departmentId: true, semesterId: true, level: true, locked: true },
    });

    clearCoursesCache();

    logAudit({
      actorId: actor.id,
      action: 'COURSE.SUBMIT',
      targetType: 'Course',
      targetId: id,
      result: 'SUCCESS',
    });

    notifyRole('SUPER_ADMIN', {
      type: 'COURSE_SUBMITTED',
      title: 'Course submitted for approval',
      message: `${updated.code} — ${updated.title} was submitted by ${actor.fullName || actor.email}.`,
      link: '/course-approvals',
      data: { courseId: id },
    }).catch(() => {});

    broadcast.toRoles('SUPER_ADMIN', 'course-submitted', { courseId: id });
    broadcast.toUser(actor.id, 'course-submitted', { courseId: id });

    return updated;
  },

  async approve(id, { comment }, actor) {
    // Single update with lightweight select — 1 DB query on the happy path.
    // The status check is done via updateMany to enforce the SUBMITTED constraint
    // without a separate findUnique, then a lightweight fetch for notification data.
    const now = new Date();
    const result = await prisma.course.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        approvedById: actor.id,
        locked: true,
        rejectionComment: null,
      },
    });

    if (result.count === 0) {
      const exists = await prisma.course.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!exists) throw ApiError.notFound('Course not found.');
      throw ApiError.badRequest('Only submitted courses can be approved.');
    }

    clearCoursesCache();

    // Fire-and-forget audit (1 connection, released instantly)
    logAudit({
      actorId: actor.id,
      action: 'COURSE.APPROVE',
      targetType: 'Course',
      targetId: id,
      result: 'SUCCESS',
      metadata: { comment },
    });

    // Fetch the course to get createdById for notification
    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true, code: true, title: true, createdById: true },
    });

    if (course?.createdById) {
      createNotification({
        userId: course.createdById,
        type: 'COURSE_APPROVED',
        title: 'Course approved',
        message: `${course.code} — ${course.title} has been approved.`,
        link: '/courses',
        data: { courseId: id },
      }).catch(() => {});
      broadcast.toUser(course.createdById, 'course-approved', { courseId: id });

      // Send email to course creator
      const creator = await prisma.user.findUnique({
        where: { id: course.createdById },
        select: { email: true, fullName: true },
      });
      if (creator?.email) {
        sendEmail({
          to: creator.email,
          subject: 'Course Approved — UENR Examination System',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #065f46; margin: 0;">✓ Course Approved</h2>
              </div>
              <p style="color: #475569; font-size: 15px;">
                Hello <strong>${creator.fullName}</strong>,
              </p>
              <p style="color: #475569; font-size: 15px;">
                Your course has been approved by the examination office.
              </p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                  <strong>Course Code:</strong> ${course.code}
                </p>
                <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                  <strong>Title:</strong> ${course.title}
                </p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${primaryClientOrigin}/courses"
                   style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">
                  View Courses
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              <p style="color: #94a3b8; font-size: 12px;">
                University of Energy and Natural Resources<br>
                Examination Management System
              </p>
            </div>
          `,
        }).catch((err) => {
          console.error('[courses] Failed to send approval email:', err);
        });
      }
    }

    broadcast.toRoles('SUPER_ADMIN', 'course-approved', { courseId: id });

    // Return a lightweight object — the frontend only needs id + status for cache update
    return { id, status: 'APPROVED', locked: true, approvedAt: now };
  },

  async approveAll(ids, actor) {
    const courses = await prisma.course.findMany({
      where: { id: { in: ids }, status: 'SUBMITTED' },
      select: { id: true, createdById: true, code: true, title: true },
    });

    if (courses.length === 0) {
      throw ApiError.badRequest('No submitted courses found to approve.');
    }

    const now = new Date();
    await prisma.course.updateMany({
      where: { id: { in: courses.map((c) => c.id) } },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        approvedById: actor.id,
        locked: true,
        rejectionComment: null,
      },
    });

    clearCoursesCache();

    // Batch all audit entries into a single createMany — 1 DB query instead of N
    logAuditBatch(
      courses.map((c) => ({
        actorId: actor.id,
        action: 'COURSE.APPROVE',
        targetType: 'Course',
        targetId: c.id,
        result: 'SUCCESS',
      }))
    );

    // Group by createdById to batch notifications
    const byCreator = new Map();
    for (const c of courses) {
      if (!c.createdById) continue;
      if (!byCreator.has(c.createdById)) byCreator.set(c.createdById, []);
      byCreator.get(c.createdById).push(c);
    }

    // One notification per creator (fire-and-forget)
    for (const [creatorId, creatorCourses] of byCreator) {
      const codes = creatorCourses.map((c) => c.code).join(', ');
      createNotification({
        userId: creatorId,
        type: 'COURSE_APPROVED',
        title: `${creatorCourses.length} course${creatorCourses.length === 1 ? '' : 's'} approved`,
        message: `Approved: ${codes}`,
        link: '/courses',
        data: { courseIds: creatorCourses.map((c) => c.id) },
      }).catch(() => {});
      broadcast.toUser(creatorId, 'course-approved', { courseIds: creatorCourses.map((c) => c.id) });

      // Send email to course creator
      const creator = await prisma.user.findUnique({
        where: { id: creatorId },
        select: { email: true, fullName: true },
      });
      if (creator?.email) {
        const courseList = creatorCourses.map((c) => `<li><strong>${c.code}</strong> — ${c.title}</li>`).join('');
        sendEmail({
          to: creator.email,
          subject: `${creatorCourses.length} Course(s) Approved — UENR Examination System`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #065f46; margin: 0;">✓ ${creatorCourses.length} Course${creatorCourses.length === 1 ? '' : 's'} Approved</h2>
              </div>
              <p style="color: #475569; font-size: 15px;">
                Hello <strong>${creator.fullName}</strong>,
              </p>
              <p style="color: #475569; font-size: 15px;">
                The following course${creatorCourses.length === 1 ? '' : 's'} ha${creatorCourses.length === 1 ? 's' : 've'} been approved by the examination office:
              </p>
              <ul style="color: #374151; font-size: 14px; line-height: 1.8;">
                ${courseList}
              </ul>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${primaryClientOrigin}/courses"
                   style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">
                  View Courses
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              <p style="color: #94a3b8; font-size: 12px;">
                University of Energy and Natural Resources<br>
                Examination Management System
              </p>
            </div>
          `,
        }).catch((err) => {
          console.error('[courses] Failed to send bulk approval email:', err);
        });
      }
    }

    broadcast.toRoles('SUPER_ADMIN', 'course-approved', { courseIds: courses.map((c) => c.id) });

    return { approved: courses.length };
  },

  async reject(id, { comment }, actor) {
    const result = await prisma.course.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: {
        status: 'REJECTED',
        rejectionComment: comment || null,
        locked: false,
      },
    });

    if (result.count === 0) {
      const exists = await prisma.course.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!exists) throw ApiError.notFound('Course not found.');
      throw ApiError.badRequest('Only submitted courses can be rejected.');
    }

    clearCoursesCache();

    logAudit({
      actorId: actor.id,
      action: 'COURSE.REJECT',
      targetType: 'Course',
      targetId: id,
      result: 'SUCCESS',
      metadata: { comment },
    });

    // Fetch the course to get createdById for notification
    const course = await prisma.course.findUnique({
      where: { id },
      select: { id: true, code: true, title: true, createdById: true },
    });

    if (course?.createdById) {
      createNotification({
        userId: course.createdById,
        type: 'COURSE_REJECTED',
        title: 'Course rejected',
        message: `${course.code} — ${course.title} was rejected${comment ? `: ${comment}` : '.'}`,
        link: '/courses',
        data: { courseId: id },
      }).catch(() => {});
      broadcast.toUser(course.createdById, 'course-rejected', { courseId: id });
    }

    broadcast.toRoles('SUPER_ADMIN', 'course-rejected', { courseId: id });

    return { id, status: 'REJECTED', locked: false, rejectionComment: comment || null };
  },

  async remove(id, actor) {
    const course = await verifyCourseOwnership(id, actor);
    if (course.locked || course.status === 'APPROVED') {
      throw ApiError.conflict('Approved or locked courses cannot be deleted.');
    }

    await prisma.course.delete({ where: { id } });

    clearCoursesCache();

    logAudit({
      actorId: actor.id,
      action: 'COURSE.DELETE',
      targetType: 'Course',
      targetId: id,
      result: 'SUCCESS',
    });

    return { id };
  },
};
