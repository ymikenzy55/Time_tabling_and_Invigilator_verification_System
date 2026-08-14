import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';

const publicSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  semester: { select: { id: true, name: true, academicYear: { select: { id: true, name: true } } } },
};

export const examinationSessionsService = {
  async list({ semesterId, q, _ensureSessions = true } = {}) {
    // Lazily create a default session for any semester that has courses but
    // no examination session yet — but only on the first call, not every poll.
    if (_ensureSessions && !examinationSessionsService._ensured) {
      examinationSessionsService._ensured = true;
      const semestersNeedingSession = await prisma.semester.findMany({
        where: {
          courses: { some: {} },
          examinationSessions: { none: {} },
        },
        select: { id: true, name: true, startDate: true, endDate: true, academicYear: { select: { name: true } } },
      });
      if (semestersNeedingSession.length > 0) {
        await prisma.examinationSession.createMany({
          data: semestersNeedingSession.map((s) => ({
            name: `${s.name} Examinations${s.academicYear?.name ? ` (${s.academicYear.name})` : ''}`,
            semesterId: s.id,
            startDate: s.startDate,
            endDate: s.endDate,
            isPublished: false,
          })),
          skipDuplicates: true,
        });
      }
    }

    return prisma.examinationSession.findMany({
      where: {
        ...(semesterId ? { semesterId } : {}),
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { semester: { name: { contains: q, mode: 'insensitive' } } },
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: publicSelect,
    });
  },

  _ensured: false,

  async getById(id) {
    const session = await prisma.examinationSession.findUnique({ where: { id }, select: publicSelect });
    if (!session) throw ApiError.notFound('Examination session not found.');
    return session;
  },

  async create(payload, actor) {
    const { name, semesterId, startDate, endDate, isPublished } = payload;
    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) throw ApiError.notFound('Semester not found.');

    const existing = await prisma.examinationSession.findFirst({
      where: { semesterId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw ApiError.conflict('An examination session with this name already exists for this semester.');

    const session = await prisma.examinationSession.create({
      data: { name, semesterId, startDate: new Date(startDate), endDate: new Date(endDate), isPublished: !!isPublished },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'EXAMINATION_SESSION.CREATE',
      targetType: 'ExaminationSession',
      targetId: session.id,
      result: 'SUCCESS',
      metadata: { name, semesterId },
    });

    return session;
  },

  async update(id, payload, actor) {
    const existing = await prisma.examinationSession.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Examination session not found.');

    const { name, semesterId, startDate, endDate, isPublished } = payload;
    if (semesterId) {
      const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
      if (!semester) throw ApiError.notFound('Semester not found.');
    }

    if (name) {
      const conflict = await prisma.examinationSession.findFirst({
        where: { id: { not: id }, semesterId: semesterId || existing.semesterId, name: { equals: name, mode: 'insensitive' } },
      });
      if (conflict) throw ApiError.conflict('An examination session with this name already exists for this semester.');
    }

    const session = await prisma.examinationSession.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(semesterId ? { semesterId } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(isPublished !== undefined ? { isPublished } : {}),
      },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'EXAMINATION_SESSION.UPDATE',
      targetType: 'ExaminationSession',
      targetId: id,
      result: 'SUCCESS',
      metadata: payload,
    });

    return session;
  },

  async remove(id, actor) {
    // Delete all related invigilations and venue assignments first
    await prisma.invigilation.deleteMany({ where: { examinationSessionId: id } });
    await prisma.venueAssignment.deleteMany({ where: { examinationSessionId: id } }).catch(() => {});

    try {
      await prisma.examinationSession.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') throw ApiError.notFound('Examination session not found.');
      throw err;
    }

    logAudit({
      actorId: actor.id,
      action: 'EXAMINATION_SESSION.DELETE',
      targetType: 'ExaminationSession',
      targetId: id,
      result: 'SUCCESS',
    });

    return { id };
  },
};
