import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { createNotification } from '../notifications/notifications.service.js';
import { logAudit } from '../../utils/auditLog.js';

const publicSelect = {
  id: true,
  scheduledAt: true,
  windowOpensAt: true,
  windowClosesAt: true,
  gracePeriodMin: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  examinationSession: {
    select: { id: true, name: true, semester: { select: { id: true, name: true, academicYear: { select: { id: true, name: true } } } } },
  },
  course: { select: { id: true, code: true, title: true, department: { select: { id: true, name: true } } } },
  invigilator: { select: { id: true, fullName: true, email: true } },
  replacement: { select: { id: true, fullName: true, email: true } },
};

const isInvigilator = (user) => user.role === 'INVIGILATOR';

const assertAdmin = (actor) => {
  if (actor.role !== 'SUPER_ADMIN') throw ApiError.forbidden('Only super admins can manage invigilations.');
};

const validateAssignment = async ({ examinationSessionId, courseId, invigilatorId, replacementId, scheduledAt, id }) => {
  const session = await prisma.examinationSession.findUnique({ where: { id: examinationSessionId } });
  if (!session) throw ApiError.notFound('Examination session not found.');

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw ApiError.notFound('Course not found.');
  if (course.status !== 'APPROVED') throw ApiError.badRequest('Only approved courses can be assigned to an examination session.');

  const invigilator = await prisma.user.findUnique({ where: { id: invigilatorId } });
  if (!invigilator || invigilator.role !== 'INVIGILATOR') throw ApiError.badRequest('Assigned user must be an invigilator.');

  if (invigilator.departmentId && course.departmentId === invigilator.departmentId) {
    throw ApiError.badRequest('An invigilator cannot be assigned to a course from their own department. Assign an invigilator from a different department.');
  }

  const duplicate = await prisma.invigilation.findFirst({
    where: {
      ...(id ? { id: { not: id } } : {}),
      examinationSessionId,
      courseId,
    },
  });
  if (duplicate) throw ApiError.conflict('This course is already assigned to this examination session.');

  if (replacementId) {
    if (replacementId === invigilatorId) throw ApiError.badRequest('Replacement cannot be the same as the primary invigilator.');
    const replacement = await prisma.user.findUnique({ where: { id: replacementId } });
    if (!replacement || replacement.role !== 'INVIGILATOR') throw ApiError.badRequest('Replacement must be an invigilator.');
  }
};

export const invigilationsService = {
  async list({ examinationSessionId, courseId, q } = {}, actor) {
    const baseWhere = {
      ...(examinationSessionId ? { examinationSessionId } : {}),
      ...(courseId ? { courseId } : {}),
      ...(q ? {
        OR: [
          { course: { code: { contains: q, mode: 'insensitive' } } },
          { course: { title: { contains: q, mode: 'insensitive' } } },
          { invigilator: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      } : {}),
    };

    if (isInvigilator(actor)) {
      return prisma.invigilation.findMany({
        where: { ...baseWhere, invigilatorId: actor.id },
        orderBy: { scheduledAt: 'asc' },
        select: publicSelect,
      });
    }

    return prisma.invigilation.findMany({
      where: baseWhere,
      orderBy: { scheduledAt: 'asc' },
      select: publicSelect,
    });
  },

  async getById(id, actor) {
    const invigilation = await prisma.invigilation.findUnique({ where: { id }, select: publicSelect });
    if (!invigilation) throw ApiError.notFound('Invigilation assignment not found.');
    if (isInvigilator(actor) && invigilation.invigilator.id !== actor.id) {
      throw ApiError.forbidden('You do not have access to this assignment.');
    }
    return invigilation;
  },

  async create(payload, actor) {
    assertAdmin(actor);
    const { examinationSessionId, courseId, invigilatorId, replacementId, scheduledAt, windowOpensAt, windowClosesAt, gracePeriodMin } = payload;

    await validateAssignment({ examinationSessionId, courseId, invigilatorId, replacementId, scheduledAt });

    const invigilation = await prisma.invigilation.create({
      data: {
        examinationSessionId,
        courseId,
        invigilatorId,
        ...(replacementId ? { replacementId } : {}),
        scheduledAt: new Date(scheduledAt),
        ...(windowOpensAt ? { windowOpensAt: new Date(windowOpensAt) } : {}),
        ...(windowClosesAt ? { windowClosesAt: new Date(windowClosesAt) } : {}),
        gracePeriodMin: gracePeriodMin || 0,
      },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'INVIGILATION.CREATE',
      targetType: 'Invigilation',
      targetId: invigilation.id,
      result: 'SUCCESS',
      metadata: { examinationSessionId, courseId, invigilatorId },
    });

    const courseLabel = invigilation.course?.code
      ? `${invigilation.course.code} — ${invigilation.course.title}`
      : 'a course';
    await createNotification({
      userId: invigilatorId,
      type: 'INVIGILATION_ASSIGNED',
      title: 'Examination Invigilation Duty',
      message: `You have been assigned to invigilate ${courseLabel} on ${new Date(scheduledAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at ${new Date(scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`,
      link: '/my-assignments',
      data: { invigilationId: invigilation.id },
    });

    return invigilation;
  },

  async update(id, payload, actor) {
    assertAdmin(actor);
    const existing = await prisma.invigilation.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Invigilation assignment not found.');

    const { examinationSessionId, courseId, invigilatorId, replacementId, scheduledAt, windowOpensAt, windowClosesAt, gracePeriodMin, isActive } = payload;

    await validateAssignment({
      examinationSessionId: examinationSessionId || existing.examinationSessionId,
      courseId: courseId || existing.courseId,
      invigilatorId: invigilatorId || existing.invigilatorId,
      replacementId: replacementId !== undefined ? replacementId : existing.replacementId,
      id,
    });

    const invigilation = await prisma.invigilation.update({
      where: { id },
      data: {
        ...(examinationSessionId ? { examinationSessionId } : {}),
        ...(courseId ? { courseId } : {}),
        ...(invigilatorId ? { invigilatorId } : {}),
        ...(replacementId !== undefined ? { replacementId } : {}),
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
        ...(windowOpensAt !== undefined ? { windowOpensAt: windowOpensAt ? new Date(windowOpensAt) : null } : {}),
        ...(windowClosesAt !== undefined ? { windowClosesAt: windowClosesAt ? new Date(windowClosesAt) : null } : {}),
        ...(gracePeriodMin !== undefined ? { gracePeriodMin } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'INVIGILATION.UPDATE',
      targetType: 'Invigilation',
      targetId: id,
      result: 'SUCCESS',
      metadata: payload,
    });

    return invigilation;
  },

  async replace(id, { replacementId }, actor) {
    assertAdmin(actor);
    const existing = await prisma.invigilation.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Invigilation assignment not found.');
    if (existing.invigilatorId === replacementId) throw ApiError.badRequest('Replacement cannot be the same as the primary invigilator.');

    const replacement = await prisma.user.findUnique({ where: { id: replacementId } });
    if (!replacement || replacement.role !== 'INVIGILATOR') throw ApiError.badRequest('Replacement must be an invigilator.');

    const invigilation = await prisma.invigilation.update({
      where: { id },
      data: { replacementId, isActive: false },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'INVIGILATION.REPLACE',
      targetType: 'Invigilation',
      targetId: id,
      result: 'SUCCESS',
      metadata: { replacementId, originalInvigilatorId: existing.invigilatorId },
    });

    await createNotification({
      userId: replacementId,
      type: 'INVIGILATION_REPLACEMENT',
      title: 'Replacement Invigilation Duty',
      message: 'You have been designated as a replacement invigilator for an upcoming examination. Review your duty schedule for details.',
      link: '/my-assignments',
      data: { invigilationId: id },
    });

    return invigilation;
  },

  async remove(id, actor) {
    assertAdmin(actor);

    try {
      await prisma.invigilation.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') throw ApiError.notFound('Invigilation assignment not found.');
      throw err;
    }

    logAudit({
      actorId: actor.id,
      action: 'INVIGILATION.DELETE',
      targetType: 'Invigilation',
      targetId: id,
      result: 'SUCCESS',
    });

    return { id };
  },
};
