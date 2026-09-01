import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

const DEFAULT_LEVEL_VALUES = [100, 200, 300, 400];

const levelSelect = {
  id: true,
  value: true,
  label: true,
  departmentId: true,
  createdAt: true,
  updatedAt: true,
};

const resolveDepartmentId = (actor, requestedDepartmentId) => {
  if (actor.role === 'DEPARTMENT_HEAD') {
    if (!actor.departmentId) {
      return null;
    }
    return actor.departmentId;
  }

  if (actor.role === 'SUPER_ADMIN') {
    return requestedDepartmentId || null;
  }

  throw ApiError.forbidden('You do not have permission to manage course levels.');
};

const ensureDefaultLevels = async (departmentId) => {
  const count = await prisma.courseLevel.count({ where: { departmentId } });
  if (count > 0) return;

  await prisma.courseLevel.createMany({
    data: DEFAULT_LEVEL_VALUES.map((value) => ({ departmentId, value })),
    skipDuplicates: true,
  });
};

export const courseLevelsService = {
  async ensureDefaultsForDepartment(departmentId) {
    await ensureDefaultLevels(departmentId);
  },

  async list(actor, { departmentId } = {}) {
    const targetDepartmentId = resolveDepartmentId(actor, departmentId);
    if (!targetDepartmentId) {
      if (actor.role === 'SUPER_ADMIN') {
        return prisma.courseLevel.findMany({
          orderBy: { value: 'asc' },
          select: levelSelect,
        });
      }
      return DEFAULT_LEVEL_VALUES.map((value) => ({
        id: `default-${value}`,
        value,
        label: null,
        departmentId: null,
        createdAt: null,
        updatedAt: null,
        readonly: true,
      }));
    }
    let levels = await prisma.courseLevel.findMany({
      where: { departmentId: targetDepartmentId },
      orderBy: { value: 'asc' },
      select: levelSelect,
    });

    // Seed defaults lazily — only when the department has no levels yet.
    if (levels.length === 0) {
      await ensureDefaultLevels(targetDepartmentId);
      levels = await prisma.courseLevel.findMany({
        where: { departmentId: targetDepartmentId },
        orderBy: { value: 'asc' },
        select: levelSelect,
      });
    }

    return levels;
  },

  async create(actor, input) {
    const targetDepartmentId = resolveDepartmentId(actor, input.departmentId);
    if (!targetDepartmentId) {
      throw ApiError.badRequest('Assign your account to a department before managing course levels.');
    }

    const value = Number(input.value);
    if (!Number.isInteger(value) || value <= 0) {
      throw ApiError.badRequest('Level must be a positive whole number.');
    }

    const existing = await prisma.courseLevel.findFirst({
      where: { departmentId: targetDepartmentId, value },
    });
    if (existing) {
      throw ApiError.conflict('This level already exists for the department.');
    }

    const level = await prisma.courseLevel.create({
      data: {
        value,
        label: input.label?.trim() || null,
        departmentId: targetDepartmentId,
      },
      select: levelSelect,
    });

    return level;
  },

  async remove(actor, id) {
    const level = await prisma.courseLevel.findUnique({
      where: { id },
      select: { id: true, value: true, departmentId: true },
    });
    if (!level) throw ApiError.notFound('Level not found.');

    const targetDepartmentId = resolveDepartmentId(actor, level.departmentId);
    if (targetDepartmentId !== level.departmentId) {
      throw ApiError.forbidden('You cannot manage levels for this department.');
    }

    const coursesUsingLevel = await prisma.course.count({
      where: { departmentId: level.departmentId, level: level.value },
    });
    if (coursesUsingLevel > 0) {
      throw ApiError.badRequest('You cannot delete a level that is used by existing courses.');
    }

    await prisma.courseLevel.delete({ where: { id } });
    return { id };
  },
};
