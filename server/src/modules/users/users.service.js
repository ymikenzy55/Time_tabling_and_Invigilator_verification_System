import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { createNotification, notifyRole } from '../notifications/notifications.service.js';
import { courseLevelsService } from '../courseLevels/courseLevels.service.js';
import { normalizeDepartmentName, ensureDepartmentForName, linkDepartmentToUser } from '../departments/departmentAutoLink.js';
import { invalidateAuthCache } from '../../middleware/auth.js';
import { logAudit } from '../../utils/auditLog.js';
import { cache } from '../../utils/cache.js';
import { sendEmail } from '../../utils/email.js';
import { primaryClientOrigin } from '../../config/env.js';

const publicSelect = {
  id: true, email: true, fullName: true, staffId: true, phone: true,
  role: true, status: true, departmentId: true, departmentName: true,
  createdAt: true, updatedAt: true, approvedAt: true, approvedById: true,
  createdById: true,
  department: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
};

export const usersService = {
  async list({ role, status, q } = {}) {
    const cacheKey = `users:list:${role || 'all'}:${status || 'all'}:${q || 'all'}`;
    return cache.remember(cacheKey, 15_000, async () =>
      prisma.user.findMany({
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
      })
    );
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
        createdById: input.createdById || null,
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
      prisma.venueAssignment.deleteMany({
        where: { invigilatorId: id },
      }),
      prisma.user.delete({ where: { id } }),
    ]);
    invalidateAuthCache(id);

    const removedAssignments = result[0].count;

    logAudit({
      actorId: actor.id,
      action: 'USER.DELETE',
      targetType: 'User',
      targetId: id,
      result: 'SUCCESS',
      metadata: {
        email: existing.email,
        role: existing.role,
        removedAssignments,
      },
    });

    // Send deletion email notification
    sendEmail({
      to: existing.email,
      subject: 'Account Deleted — UENR Examination System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0;">Account Deleted</h2>
          </div>
          <p style="color: #475569; font-size: 15px;">
            Hello <strong>${existing.fullName}</strong>,
          </p>
          <p style="color: #475569; font-size: 15px;">
            Your account has been permanently deleted from the UENR Examination Management System by the examination office.
          </p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #374151; font-size: 14px; margin: 8px 0;">
              <strong>Email:</strong> ${existing.email}
            </p>
            ${existing.staffId ? `<p style="color: #374151; font-size: 14px; margin: 8px 0;">
              <strong>Staff ID:</strong> ${existing.staffId}
            </p>` : ''}
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 30px;">
            If you believe this is an error, please contact the examination office immediately.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            University of Energy and Natural Resources<br>
            Examination Management System
          </p>
        </div>
      `,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[users] Failed to send deletion email:', err);
    });

    return { id, removedAssignments };
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw ApiError.notFound('Account not found.');

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw ApiError.badRequest('Your current password is incorrect.');

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Invalidate auth cache to force re-authentication with new password
    invalidateAuthCache(userId);

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

    // Send in-app notification
    await createNotification({
      userId: id,
      type: 'ACCOUNT_APPROVED',
      title: 'Your account has been approved',
      message: roleMessages[approvedUser.role] || 'You can now sign in and start using the platform.',
      link: roleLinks[approvedUser.role] || '/dashboard',
    });

    // Send approval email
    sendEmail({
      to: approvedUser.email,
      subject: 'Account Approved — UENR Examination System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0; font-size: 24px;">✓ Account Approved!</h2>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
            <p style="color: #111827; font-size: 16px; margin-bottom: 15px;">
              Hello <strong>${approvedUser.fullName}</strong>,
            </p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              Great news! Your account as <strong>${approvedUser.role.replace('_', ' ')}</strong> has been approved by the examination office.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #10b981;">
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Email:</strong> ${approvedUser.email}
              </p>
              ${approvedUser.staffId ? `<p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Staff ID:</strong> ${approvedUser.staffId}
              </p>` : ''}
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Role:</strong> ${approvedUser.role.replace('_', ' ')}
              </p>
            </div>
            <p style="color: #374151; font-size: 15px; margin-bottom: 25px;">
              ${roleMessages[approvedUser.role] || 'You can now sign in and start using the platform.'}
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${primaryClientOrigin}/login"
                 style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">
                Sign In Now
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin-top: 30px;">
              If you have any questions or need assistance, please contact the examination office.
            </p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            University of Energy and Natural Resources<br>
            Examination Management System
          </p>
        </div>
      `,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[users] Failed to send approval email:', err);
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
      createdById: actor.id,
    }, actor);
  },

  async createDelegate(input, actor) {
    if (actor.role !== 'INVIGILATOR') {
      throw ApiError.forbidden('Only invigilators can create delegate invigilators.');
    }

    return usersService.create({
      ...input,
      role: 'INVIGILATOR',
      createdById: actor.id,
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

    // Send in-app notification
    await createNotification({
      userId: id,
      type: 'ACCOUNT_REJECTED',
      title: 'Your account application was rejected',
      message: reason || 'Please contact the Examination Office for details.',
    });

    // Send rejection email
    sendEmail({
      to: updated.email,
      subject: 'Account Application Status — UENR Examination System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b;">Account Application Update</h2>
          <p style="color: #475569; font-size: 15px;">
            Hello <strong>${updated.fullName}</strong>,
          </p>
          <p style="color: #475569; font-size: 15px;">
            We regret to inform you that your registration application as <strong>${updated.role.replace('_', ' ')}</strong> 
            has not been approved at this time.
          </p>
          ${reason ? `
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="color: #991b1b; font-size: 14px; margin: 0;">
              <strong>Reason:</strong> ${reason}
            </p>
          </div>
          ` : ''}
          <p style="color: #475569; font-size: 15px;">
            If you believe this is an error or have additional questions, please contact the examination office for further assistance.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            University of Energy and Natural Resources<br>
            Examination Management System
          </p>
        </div>
      `,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[users] Failed to send rejection email:', err);
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

    // Send in-app notification
    await createNotification({
      userId: id,
      type: status === 'ACTIVE' ? 'ACCOUNT_APPROVED' : 'ACCOUNT_REJECTED',
      title: status === 'ACTIVE' ? 'Your account has been reactivated' : 'Your account has been restricted',
      message: status === 'ACTIVE'
        ? 'You can now sign in again.'
        : 'You cannot sign in until an administrator reactivates your account.',
    });

    // Send email notification
    if (status === 'SUSPENDED' || status === 'DISABLED') {
      // Account suspended/disabled email
      sendEmail({
        to: updated.email,
        subject: 'Account Status Update — UENR Examination System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #991b1b; margin: 0;">Account ${status === 'SUSPENDED' ? 'Suspended' : 'Disabled'}</h2>
            </div>
            <p style="color: #475569; font-size: 15px;">
              Hello <strong>${updated.fullName}</strong>,
            </p>
            <p style="color: #475569; font-size: 15px;">
              Your account has been <strong>${status.toLowerCase()}</strong> by the examination office.
            </p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Email:</strong> ${updated.email}
              </p>
              ${updated.staffId ? `<p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Staff ID:</strong> ${updated.staffId}
              </p>` : ''}
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Status:</strong> <span style="color: #dc2626;">${status}</span>
              </p>
            </div>
            <p style="color: #475569; font-size: 15px;">
              You will not be able to sign in until an administrator reactivates your account.
            </p>
            <p style="color: #64748b; font-size: 13px; margin-top: 30px;">
              If you believe this is an error, please contact the examination office immediately.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              University of Energy and Natural Resources<br>
              Examination Management System
            </p>
          </div>
        `,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[users] Failed to send suspension email:', err);
      });
    } else if (status === 'ACTIVE' && user.status !== 'PENDING_APPROVAL') {
      // Account reactivated email
      sendEmail({
        to: updated.email,
        subject: 'Account Reactivated — UENR Examination System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #065f46; margin: 0;">✓ Account Reactivated</h2>
            </div>
            <p style="color: #475569; font-size: 15px;">
              Hello <strong>${updated.fullName}</strong>,
            </p>
            <p style="color: #475569; font-size: 15px;">
              Good news! Your account has been <strong>reactivated</strong> by the examination office.
            </p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Email:</strong> ${updated.email}
              </p>
              ${updated.staffId ? `<p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Staff ID:</strong> ${updated.staffId}
              </p>` : ''}
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Status:</strong> <span style="color: #059669;">ACTIVE</span>
              </p>
            </div>
            <p style="color: #475569; font-size: 15px;">
              You can now sign in and access the system again.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${primaryClientOrigin}/login"
                 style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">
                Sign In Now
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
        // eslint-disable-next-line no-console
        console.error('[users] Failed to send reactivation email:', err);
      });
    }

    return updated;
  },
};
