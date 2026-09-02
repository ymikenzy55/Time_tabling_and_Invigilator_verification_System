import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';
import { ensureDefaultSemesters } from './semesters.defaults.js';

const publicSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
  academicYearId: true,
  academicYear: { select: { id: true, name: true } },
  _count: { select: { courses: true } },
};

export const semestersService = {
  _ensured: false,

  async list({ academicYearId } = {}) {
    const where = academicYearId ? { academicYearId } : undefined;

    let semesters = await prisma.semester.findMany({
      where,
      orderBy: { startDate: 'asc' },
      select: publicSelect,
    });

    // Seed defaults lazily — only once per server lifecycle, not on every call.
    if (semesters.length === 0 && !semestersService._ensured) {
      semestersService._ensured = true;
      await prisma.$transaction((tx) => ensureDefaultSemesters(tx, { academicYearId }));
      semesters = await prisma.semester.findMany({
        where,
        orderBy: { startDate: 'asc' },
        select: publicSelect,
      });
    }

    return semesters;
  },

  async getById(id) {
    const semester = await prisma.semester.findUnique({
      where: { id },
      select: publicSelect,
    });
    if (!semester) throw ApiError.notFound('Semester not found.');
    return semester;
  },

  async create({ name, academicYearId, startDate, endDate, isActive = false }, actor) {
    const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!academicYear) throw ApiError.notFound('Academic year not found.');

    const existing = await prisma.semester.findFirst({
      where: { academicYearId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw ApiError.conflict('A semester with this name already exists in this academic year.');

    const result = await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.semester.updateMany({ data: { isActive: false } });
      }
      return tx.semester.create({
        data: { name, academicYearId, startDate, endDate, isActive },
        select: publicSelect,
      });
    });

    logAudit({
      actorId: actor.id,
      action: 'SEMESTER.CREATE',
      targetType: 'Semester',
      targetId: result.id,
      result: 'SUCCESS',
      metadata: { name, academicYearId, isActive },
    });

    return result;
  },

  async update(id, { name, academicYearId, startDate, endDate, isActive }, actor) {
    const existing = await prisma.semester.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Semester not found.');

    if (academicYearId) {
      const academicYear = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
      if (!academicYear) throw ApiError.notFound('Academic year not found.');
    }

    if (name || academicYearId) {
      const conflict = await prisma.semester.findFirst({
        where: {
          id: { not: id },
          academicYearId: academicYearId || existing.academicYearId,
          name: { equals: name || existing.name, mode: 'insensitive' },
        },
      });
      if (conflict) throw ApiError.conflict('A semester with this name already exists in this academic year.');
    }

    const result = await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.semester.updateMany({ data: { isActive: false } });
      }
      return tx.semester.update({
        where: { id },
        data: { name, academicYearId, startDate, endDate, isActive },
        select: publicSelect,
      });
    });

    logAudit({
      actorId: actor.id,
      action: 'SEMESTER.UPDATE',
      targetType: 'Semester',
      targetId: id,
      result: 'SUCCESS',
      metadata: { name, academicYearId, isActive },
    });

    return result;
  },

  async remove(id, actor) {
    const courseCount = await prisma.course.count({ where: { semesterId: id } });
    if (courseCount > 0) {
      throw ApiError.conflict('This semester has courses. Delete them first.');
    }

    try {
      await prisma.semester.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') throw ApiError.notFound('Semester not found.');
      throw err;
    }

    logAudit({
      actorId: actor.id,
      action: 'SEMESTER.DELETE',
      targetType: 'Semester',
      targetId: id,
      result: 'SUCCESS',
    });

    return { id };
  },
};
