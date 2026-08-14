import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';

const publicSelect = {
  id: true, name: true, code: true, createdAt: true, updatedAt: true,
  _count: { select: { departments: true } },
};

export const facultiesService = {
  async list({ q } = {}) {
    return prisma.faculty.findMany({
      where: q ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ]} : undefined,
      orderBy: { name: 'asc' },
      select: publicSelect,
    });
  },

  async getById(id) {
    const faculty = await prisma.faculty.findUnique({
      where: { id },
      select: { ...publicSelect, departments: { select: { id: true, name: true, code: true } } },
    });
    if (!faculty) throw ApiError.notFound('Faculty not found.');
    return faculty;
  },

  async create({ name, code }, actor) {
    const exists = await prisma.faculty.findFirst({
      where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { code: { equals: code, mode: 'insensitive' } }] },
    });
    if (exists) throw ApiError.conflict('A faculty with this name or code already exists.');

    const faculty = await prisma.faculty.create({
      data: { name, code },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'FACULTY.CREATE',
      targetType: 'Faculty',
      targetId: faculty.id,
      result: 'SUCCESS',
      metadata: { name, code },
    });

    return faculty;
  },

  async update(id, { name, code }, actor) {
    const existing = await prisma.faculty.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Faculty not found.');

    if (name || code) {
      const conflict = await prisma.faculty.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(name ? [{ name: { equals: name, mode: 'insensitive' } }] : []),
            ...(code ? [{ code: { equals: code, mode: 'insensitive' } }] : []),
          ],
        },
      });
      if (conflict) throw ApiError.conflict('A faculty with this name or code already exists.');
    }

    const faculty = await prisma.faculty.update({
      where: { id },
      data: { name, code },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'FACULTY.UPDATE',
      targetType: 'Faculty',
      targetId: id,
      result: 'SUCCESS',
      metadata: { name, code },
    });

    return faculty;
  },

  async remove(id, actor) {
    const deptCount = await prisma.department.count({ where: { facultyId: id } });
    if (deptCount > 0) {
      throw ApiError.conflict('This faculty has departments. Move or delete them first.');
    }

    try {
      await prisma.faculty.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') throw ApiError.notFound('Faculty not found.');
      throw err;
    }

    logAudit({
      actorId: actor.id,
      action: 'FACULTY.DELETE',
      targetType: 'Faculty',
      targetId: id,
      result: 'SUCCESS',
    });

    return { id };
  },
};
