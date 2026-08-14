import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';

const publicSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
  _count: { select: { semesters: true } },
};

export const academicYearsService = {
  async list() {
    return prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      select: publicSelect,
    });
  },

  async getById(id) {
    const academicYear = await prisma.academicYear.findUnique({
      where: { id },
      select: { ...publicSelect, semesters: { select: { id: true, name: true, isActive: true } } },
    });
    if (!academicYear) throw ApiError.notFound('Academic year not found.');
    return academicYear;
  },

  async create({ name, startDate, endDate, isActive = false }, actor) {
    const existing = await prisma.academicYear.findUnique({ where: { name } });
    if (existing) throw ApiError.conflict('An academic year with this name already exists.');

    const result = await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.academicYear.updateMany({ data: { isActive: false } });
      }
      return tx.academicYear.create({
        data: { name, startDate, endDate, isActive },
        select: publicSelect,
      });
    });

    logAudit({
      actorId: actor.id,
      action: 'ACADEMIC_YEAR.CREATE',
      targetType: 'AcademicYear',
      targetId: result.id,
      result: 'SUCCESS',
      metadata: { name, isActive },
    });

    return result;
  },

  async update(id, { name, startDate, endDate, isActive }, actor) {
    const existing = await prisma.academicYear.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Academic year not found.');

    if (name && name !== existing.name) {
      const conflict = await prisma.academicYear.findUnique({ where: { name } });
      if (conflict) throw ApiError.conflict('An academic year with this name already exists.');
    }

    const result = await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.academicYear.updateMany({ data: { isActive: false } });
      }
      return tx.academicYear.update({
        where: { id },
        data: { name, startDate, endDate, isActive },
        select: publicSelect,
      });
    });

    logAudit({
      actorId: actor.id,
      action: 'ACADEMIC_YEAR.UPDATE',
      targetType: 'AcademicYear',
      targetId: id,
      result: 'SUCCESS',
      metadata: { name, isActive },
    });

    return result;
  },

  async remove(id, actor) {
    const semCount = await prisma.semester.count({ where: { academicYearId: id } });
    if (semCount > 0) {
      throw ApiError.conflict('This academic year has semesters. Delete them first.');
    }

    try {
      await prisma.academicYear.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') throw ApiError.notFound('Academic year not found.');
      throw err;
    }

    logAudit({
      actorId: actor.id,
      action: 'ACADEMIC_YEAR.DELETE',
      targetType: 'AcademicYear',
      targetId: id,
      result: 'SUCCESS',
    });

    return { id };
  },
};
