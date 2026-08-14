import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { createNotification, notifyRole } from '../notifications/notifications.service.js';
import { courseLevelsService } from '../courseLevels/courseLevels.service.js';
import { normalizeDepartmentName, ensureDepartmentForName, linkDepartmentToUser } from '../departments/departmentAutoLink.js';
import { invalidateAuthCache } from '../../middleware/auth.js';
import { logAudit } from '../../utils/auditLog.js';

const publicSelect = {
  id: true, email: true, fullName: true, staffId: true, phone: true,
  role: true, status: true, departmentId: true, departmentName: true,
  createdAt: true, updatedAt: true, approvedAt: true,
  department: { select: { id: true, name: true, code: true } },
};

export const usersService = {
  async list({ role, status, q } = {}) {
    return prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { email:    { contains: q, mode: 'insensitive' } },
                { fullName: { contains: q, mode: 'insensitive' } },
                { staffId:  { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: publicSelect,
    });
  },

  async getById(id) {
    const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
    if (!user) throw ApiError.notFound('User not found.');
    return user;
  },

  async create(input, actor) {
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingEmail) throw ApiError.conflict('A user with this email already exists.');

    if (input.staffId) {
      const existingStaff = await prisma.user.findUnique({ where: { staffId: input.staffId } });
      if (existingStaff) throw ApiError.conflict('A user with this staff ID already exists.');
    }

    let departmentId = input.departmentId || null;
    let departmentName = input.departmentName || null;
    if (input.role === 'DEPARTMENT_HEAD' && !departmentId) {
      const normalized = normalizeDepartmentName(departmentName);
      if (normalized) {
        const department = await ensureDepartmentForName(prisma, normalized);
        if (department) {
          departmentId = department.id;
          departmentName = department.name;
        }
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        staffId: input.staffId,
        phone: input.phone,
        role: input.role,
        passwordHash,
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedById: actor.id,
        departmentId,
        departmentName,
      },
      select: publicSelect,
    });

    logAudit({
      actorId: actor.id,
      action: 'USER.CREATE',
      targetType: 'User',
      targetId: user.id,
      result: 'SUCCESS',
      metadata: { role: user.role, email: user.email },
    });

    return user;
  },

  async update(id, data, actor) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('User not found.');

    if (data.departmentId && actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only Super Admins can reassign departments.');
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: publicSelect,
    });
    invalidateAuthCache(id);

    logAudit({
      actorId: actor.id,
      action: 'USER.UPDATE',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
      metadata: { changes: data },
    });

    return user;
  },

  async remove(id, actor) {
    if (id === actor.id) {
      throw ApiError.badRequest('You cannot delete your own account.');
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('User not found.');

    // Prevent removing the last Super Admin — keeps the platform accessible.
    if (existing.role === 'SUPER_ADMIN') {
      const activeAdmins = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
      });
      if (activeAdmins <= 1) {
        throw ApiError.badRequest('You cannot remove the last active Super Admin.');
      }
    }

    const result = await prisma.$transaction([
      prisma.invigilation.deleteMany({
        where: { OR: [{ invigilatorId: id }, { replacementId: id }] },
      }),
      prisma.user.delete({ where: { id } }),
    ]);
    invalidateAuthCache(id);

    const removedInvigilations = result[0]?.count ?? 0;

    logAudit({
      actorId: actor.id,
      action: 'USER.DELETE',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
      metadata: {
        email: existing.email,
        role: existing.role,
        removedInvigilations,
      },
    });

    return { id, removedInvigilations };
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw ApiError.notFound('Account not found.');

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw ApiError.badRequest('Your current password is incorrect.');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    logAudit({
      actorId: userId,
      action: 'USER.CHANGE_PASSWORD',
      targetType: 'User',
      targetId: userId,
      result: 'SUCCESS',
    });

    return { message: 'Password updated.' };
  },

  async listPendingApprovals() {
    return prisma.user.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'asc' },
      select: publicSelect,
    });
  },

  async approveUser(id, actor) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found.');
    if (user.status !== 'PENDING_APPROVAL') {
      throw ApiError.badRequest('This user is not awaiting approval.');
    }

    const { approvedUser, linkedDepartmentId } = await prisma.$transaction(async (tx) => {
      let updated = await tx.user.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          approvedAt: new Date(),
          approvedById: actor.id,
        },
        select: publicSelect,
      });

      let departmentId = updated.departmentId;

      if (updated.role === 'DEPARTMENT_HEAD') {
        const { department, updatedUser } = await linkDepartmentToUser(tx, updated, {
          select: publicSelect,
          departmentNameOverride: updated.departmentName || user.departmentName,
        });
        if (department) {
          departmentId = department.id;
          updated = updatedUser ?? updated;
        }
      }

      return { approvedUser: updated, linkedDepartmentId: departmentId };
    });

    if (linkedDepartmentId) {
      await courseLevelsService.ensureDefaultsForDepartment(linkedDepartmentId);
    }

    logAudit({
      actorId: actor.id,
      action: 'USER.APPROVE',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
    });

    const roleLinks = {
      INVIGILATOR: '/my-assignments',
      DEPARTMENT_HEAD: '/my-department',
      SUPER_ADMIN: '/dashboard',
    };
    const roleMessages = {
      INVIGILATOR: 'You can now sign in and view your invigilation assignments.',
      DEPARTMENT_HEAD: 'You can now sign in and manage your department courses.',
      SUPER_ADMIN: 'You can now sign in and start managing the platform.',
    };

    await createNotification({
      userId: id,
      type: 'ACCOUNT_APPROVED',
      title: 'Your account has been approved',
      message: roleMessages[approvedUser.role] || 'You can now sign in and start using the platform.',
      link: roleLinks[approvedUser.role] || '/dashboard',
    });

    return approvedUser;
  },

  async listPeerDepartmentHeads(actor) {
    if (actor.role !== 'DEPARTMENT_HEAD') {
      throw ApiError.forbidden('Only Department Heads can view their peers.');
    }
    if (!actor.departmentId) {
      throw ApiError.badRequest('Your account has no department assigned. Contact the Examination Office.');
    }

    return prisma.user.findMany({
      where: {
        role: 'DEPARTMENT_HEAD',
        departmentId: actor.departmentId,
      },
      orderBy: { createdAt: 'desc' },
      select: publicSelect,
    });
  },

  async createPeerDepartmentHead(input, actor) {
    if (actor.role !== 'DEPARTMENT_HEAD') {
      throw ApiError.forbidden('Only Department Heads can create additional Department Heads.');
    }
    if (!actor.departmentId) {
      throw ApiError.badRequest('Your account has no department assigned. Contact the Examination Office.');
    }

    return usersService.create({
      ...input,
      role: 'DEPARTMENT_HEAD',
      departmentId: actor.departmentId,
      departmentName: actor.departmentName,
    }, actor);
  },

  async rejectUser(id, { reason }, actor) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found.');
    if (user.status !== 'PENDING_APPROVAL') {
      throw ApiError.badRequest('This user is not awaiting approval.');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: 'REJECTED' },
      select: publicSelect,
    });
    invalidateAuthCache(id);

    logAudit({
      actorId: actor.id,
      action: 'USER.REJECT',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
      metadata: { reason },
    });

    await createNotification({
      userId: id,
      type: 'ACCOUNT_REJECTED',
      title: 'Your account application was rejected',
      message: reason || 'Please contact the Examination Office for details.',
    });

    return updated;
  },

  async setStatus(id, { status }, actor) {
    if (id === actor.id) {
      throw ApiError.badRequest('You cannot change your own account status.');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw ApiError.notFound('User not found.');

    if (!['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) {
      throw ApiError.badRequest('Invalid status transition.');
    }

    if (user.role === 'SUPER_ADMIN' && status !== 'ACTIVE') {
      const activeAdmins = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: id } },
      });
      if (activeAdmins === 0) {
        throw ApiError.badRequest('You cannot suspend the last active Super Admin.');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
      select: publicSelect,
    });
    invalidateAuthCache(id);

    logAudit({
      actorId: actor.id,
      action: status === 'ACTIVE' ? 'USER.ENABLE' : 'USER.SUSPEND',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
      metadata: { previousStatus: user.status, newStatus: status },
    });

    await createNotification({
      userId: id,
      type: status === 'ACTIVE' ? 'ACCOUNT_APPROVED' : 'ACCOUNT_REJECTED',
      title: status === 'ACTIVE' ? 'Your account has been reactivated' : 'Your account has been restricted',
      message: status === 'ACTIVE'
        ? 'You can now sign in again.'
        : 'You cannot sign in until an administrator reactivates your account.',
    });

    return updated;
  },
};
