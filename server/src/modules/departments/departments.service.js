import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { courseLevelsService } from '../courseLevels/courseLevels.service.js';
import { logAudit } from '../../utils/auditLog.js';
import { normalizeDepartmentName, linkDepartmentToUser, buildDepartmentCode } from './departmentAutoLink.js';
import { cache } from '../../utils/cache.js';

const publicSelect = {
  id: true,
  name: true,
  code: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, courses: true, courseLevels: true } },
};

const syncDepartmentHeadsByName = async (department) => {
  if (!department) return;

  await prisma.user.updateMany({
    where: {
      role: 'DEPARTMENT_HEAD',
      departmentId: null,
      departmentName: {
        equals: department.name,
        mode: 'insensitive',
      },
    },
    data: {
      departmentId: department.id,
      departmentName: department.name,
    },
  });
};

export const departmentsService = {
  async listNames() {
    return cache.remember('departments:names', 60_000, async () =>
      prisma.department.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      })
    );
  },

  async list({ q } = {}) {
    const cacheKey = `departments:list:${q || 'all'}`;
    return cache.remember(cacheKey, 30_000, async () =>
      prisma.department.findMany({
        where: q ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ]} : undefined,
        orderBy: { name: 'asc' },
        select: publicSelect,
      })
    );
  },

  async getById(id) {
    const department = await prisma.department.findUnique({
      where: { id },
      select: publicSelect,
    });
    if (!department) throw ApiError.notFound('Department not found.');
    return department;
  },

  async getForDepartmentHead(actor) {
    if (!actor.departmentId && actor.departmentName) {
      const { department: linkedDepartment, updatedUser } = await linkDepartmentToUser(prisma, actor, {
        select: { id: true, departmentId: true, departmentName: true },
      });

      if (linkedDepartment) {
        actor.departmentId = updatedUser?.departmentId ?? linkedDepartment.id;
        actor.departmentName = updatedUser?.departmentName ?? linkedDepartment.name;
        await courseLevelsService.ensureDefaultsForDepartment(actor.departmentId);
      }
    }

    if (!actor.departmentId) {
      const requestedName = normalizeDepartmentName(actor.departmentName);
      return {
        department: null,
        meta: requestedName
          ? { placeholder: true, requestedName }
          : { placeholder: true },
      };
    }

    const department = await prisma.department.findUnique({
      where: { id: actor.departmentId },
      select: {
        ...publicSelect,
        courseLevels: {
          select: { id: true, value: true, label: true, createdAt: true },
          orderBy: { value: 'asc' },
        },
      },
    });

    if (!department) {
      const requestedName = normalizeDepartmentName(actor.departmentName);
      return {
        department: null,
        meta: {
          placeholder: true,
          requestedName: requestedName || null,
          missingDepartmentId: actor.departmentId,
        },
      };
    }

    return { department }; // meta omitted when fully linked
  },

  async create({ name, code }, actor) {
    const exists = await prisma.department.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (exists) throw ApiError.conflict('A department with this name already exists.');

    let finalCode = code;
    if (!finalCode) {
      finalCode = buildDepartmentCode(name);
      let attempt = 1;
      while (await prisma.department.findUnique({ where: { code: finalCode } })) {
        attempt += 1;
        finalCode = `${buildDepartmentCode(name)}${attempt}`.slice(0, 10);
      }
    } else {
      const codeExists = await prisma.department.findUnique({ where: { code: finalCode } });
      if (codeExists) throw ApiError.conflict('A department with this code already exists.');
    }

    const department = await prisma.department.create({
      data: { name, code: finalCode },
      select: publicSelect,
    });

    await syncDepartmentHeadsByName(department);
    cache.clear('departments:names');

    logAudit({
      actorId: actor.id,
      action: 'DEPARTMENT.CREATE',
      targetType: 'Department',
      targetId: department.id,
      result: 'SUCCESS',
      metadata: { name, code: finalCode },
    });

    return department;
  },

  async update(id, { name, code }, actor) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Department not found.');

    const conflict = await prisma.department.findFirst({
      where: {
        id: { not: id },
        OR: [
          ...(code ? [{ code: { equals: code, mode: 'insensitive' } }] : []),
          ...(name ? [{ name: { equals: name, mode: 'insensitive' } }] : []),
        ],
      },
    });
    if (conflict) throw ApiError.conflict('A department with this name or code already exists.');

    const department = await prisma.department.update({
      where: { id },
      data: { name, code },
      select: publicSelect,
    });
    cache.clear('departments:names');

    logAudit({
      actorId: actor.id,
      action: 'DEPARTMENT.UPDATE',
      targetType: 'Department',
      targetId: id,
      result: 'SUCCESS',
      metadata: { name, code },
    });

    return department;
  },

  async remove(id, actor) {
    const [userCount, courseCount] = await Promise.all([
      prisma.user.count({ where: { departmentId: id } }),
      prisma.course.count({ where: { departmentId: id } }),
    ]);
    if (userCount > 0 || courseCount > 0) {
      throw ApiError.conflict('This department has users or courses. Move or delete them first.');
    }

    try {
      await prisma.department.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') throw ApiError.notFound('Department not found.');
      throw err;
    }
    cache.clear('departments:names');

    logAudit({
      actorId: actor.id,
      action: 'DEPARTMENT.DELETE',
      targetType: 'Department',
      targetId: id,
      result: 'SUCCESS',
    });

    return { id };
  },
};
