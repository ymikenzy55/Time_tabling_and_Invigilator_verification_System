import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/password.js';
import { notifyRole } from '../notifications/notifications.service.js';
import { logAudit } from '../../utils/auditLog.js';
import { broadcast } from '../../utils/broadcast.js';
import { cache } from '../../utils/cache.js';
import { courseLevelsService } from '../courseLevels/courseLevels.service.js';
import { normalizeDepartmentName, linkDepartmentToUser } from '../departments/departmentAutoLink.js';
import { sendEmail } from '../../utils/email.js';
import { primaryClientOrigin } from '../../config/env.js';

const OPEN_ROLES = ['DEPARTMENT_HEAD', 'INVIGILATOR'];

const serializeWindow = (row) =>
  row
    ? { role: row.role, opensAt: row.opensAt, closesAt: row.closesAt, updatedAt: row.updatedAt }
    : null;

const isOpen = (row, now = new Date()) =>
  !!row && row.opensAt <= now && row.closesAt >= now;

export const registrationService = {
  /** PUBLIC: window status for every role that supports self-registration. */
  async status() {
    return cache.remember('registration:status', 30_000, async () => {
      const rows = await prisma.registrationWindow.findMany({
        where: { role: { in: OPEN_ROLES } },
      });
      const map = Object.fromEntries(rows.map((r) => [r.role, r]));
      const now = new Date();

      return {
        anyOpen: OPEN_ROLES.some((r) => isOpen(map[r], now)),
        roles: OPEN_ROLES.map((role) => ({
          role,
          open: isOpen(map[role], now),
          opensAt: map[role]?.opensAt ?? null,
          closesAt: map[role]?.closesAt ?? null,
        })),
      };
    });
  },

  /** ADMIN: list every window (including closed ones). */
  async listWindows() {
    const rows = await prisma.registrationWindow.findMany({
      where: { role: { in: OPEN_ROLES } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.role, r]));
    return OPEN_ROLES.map((role) => ({
      role,
      opensAt: map[role]?.opensAt ?? null,
      closesAt: map[role]?.closesAt ?? null,
      updatedAt: map[role]?.updatedAt ?? null,
    }));
  },

  /** ADMIN: set/replace a window for a role. */
  async setWindow(role, { opensAt, closesAt }, actor) {
    if (!OPEN_ROLES.includes(role)) {
      throw ApiError.badRequest('Registration windows can only be set for Department Heads or Invigilators.');
    }
    const opens = new Date(opensAt);
    const closes = new Date(closesAt);
    if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) {
      throw ApiError.badRequest('Please provide valid start and end dates.');
    }
    if (closes <= opens) {
      throw ApiError.badRequest('The registration deadline must be after the opening date.');
    }

    const row = await prisma.registrationWindow.upsert({
      where: { role },
      create: { role, opensAt: opens, closesAt: closes, updatedById: actor.id },
      update: { opensAt: opens, closesAt: closes, updatedById: actor.id },
    });

    cache.clear('registration:status');

    logAudit({
      actorId: actor.id,
      action: 'REGISTRATION.WINDOW_SET',
      targetType: 'RegistrationWindow',
      targetId: role,
      result: 'SUCCESS',
      metadata: { role, opensAt: row.opensAt, closesAt: row.closesAt },
    });

    return serializeWindow(row);
  },

  /** ADMIN: close (delete) a window for a role. */
  async closeWindow(role, actor) {
    if (!OPEN_ROLES.includes(role)) throw ApiError.badRequest('Unknown role.');
    await prisma.registrationWindow.deleteMany({ where: { role } });
    cache.clear('registration:status');
    logAudit({
      actorId: actor.id,
      action: 'REGISTRATION.WINDOW_CLOSE',
      targetType: 'RegistrationWindow',
      targetId: role,
      result: 'SUCCESS',
    });
    return { role };
  },

  /** PUBLIC: check if a staff ID is already taken. */
  async checkStaffId(staffId) {
    if (!staffId || !staffId.trim()) return { available: false };
    const existing = await prisma.user.findUnique({ where: { staffId: staffId.trim() } });
    return { available: !existing };
  },

  /** PUBLIC: check if an email is already taken. */
  async checkEmail(email) {
    if (!email || !email.trim()) return { available: false };
    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    return { available: !existing };
  },

  /** PUBLIC: create a self-registered user. */
  async register(payload) {
    const {
      role, email, fullName, staffId, phone, password, departmentName, departmentId,
    } = payload;

    if (!OPEN_ROLES.includes(role)) {
      throw ApiError.badRequest('This role cannot register through the login page.');
    }

    const window = await prisma.registrationWindow.findUnique({ where: { role } });
    if (!isOpen(window)) {
      throw ApiError.badRequest('Registration for this role is not currently open. Please try again during the registration window.');
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw ApiError.conflict('An account with this email already exists.');

    if (staffId) {
      const existingStaff = await prisma.user.findUnique({ where: { staffId } });
      if (existingStaff) throw ApiError.conflict('This staff ID is already in use.');
    }

    if (role === 'INVIGILATOR' && !departmentName) {
      throw ApiError.badRequest('Please enter the department you belong to.');
    }

    const normalizedDeptName = normalizeDepartmentName(departmentName);
    if (role === 'INVIGILATOR' && !normalizedDeptName) {
      throw ApiError.badRequest('Please enter a valid department name.');
    }

    const normalizedDepartmentName = normalizeDepartmentName(departmentName);
    if (role === 'DEPARTMENT_HEAD' && !normalizedDepartmentName) {
      throw ApiError.badRequest('Please enter the department you are heading.');
    }

    const passwordHash = await hashPassword(password);
    const registerSelect = {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      departmentId: true,
      departmentName: true,
    };

    const { user, department } = await prisma.$transaction(async (tx) => {
      const status = 'PENDING_APPROVAL';

      let createdUser = await tx.user.create({
        data: {
          email,
          role,
          fullName,
          staffId: staffId || null,
          phone: phone || null,
          passwordHash,
          status,
          approvedAt: status === 'ACTIVE' ? new Date() : null,
          departmentName: normalizedDepartmentName || null,
        },
        select: registerSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: createdUser.id,
          action: 'USER.REGISTER',
          targetType: 'User',
          targetId: createdUser.id,
          result: 'SUCCESS',
          metadata: { email: createdUser.email, role: createdUser.role },
        },
      });

      if (!normalizedDepartmentName) {
        return { user: createdUser, department: null };
      }

      const { department: departmentRecord, updatedUser } = await linkDepartmentToUser(tx, createdUser, {
        select: registerSelect,
        departmentNameOverride: normalizedDepartmentName,
      });

      if (!departmentRecord) {
        return { user: createdUser, department: null };
      }

      createdUser = updatedUser ?? createdUser;

      return { user: createdUser, department: departmentRecord };
    });

    if (department && role === 'DEPARTMENT_HEAD') {
      courseLevelsService.ensureDefaultsForDepartment(department.id).catch(() => {});
    }

    if (user.status === 'PENDING_APPROVAL') {
      // Send confirmation email to the user
      sendEmail({
        to: user.email,
        subject: 'Registration Received — UENR Examination System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e293b;">Thank You for Registering!</h2>
            <p style="color: #475569; font-size: 15px;">
              Hello <strong>${user.fullName}</strong>,
            </p>
            <p style="color: #475569; font-size: 15px;">
              We have received your registration as <strong>${user.role.replace('_', ' ')}</strong>.
            </p>
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #334155; font-size: 14px; margin: 5px 0;">
                <strong>Email:</strong> ${user.email}
              </p>
              ${user.staffId ? `<p style="color: #334155; font-size: 14px; margin: 5px 0;">
                <strong>Staff ID:</strong> ${user.staffId}
              </p>` : ''}
              ${department ? `<p style="color: #334155; font-size: 14px; margin: 5px 0;">
                <strong>Department:</strong> ${department.name}
              </p>` : ''}
            </div>
            <p style="color: #475569; font-size: 15px;">
              Your account is currently <strong style="color: #f59e0b;">pending approval</strong> by the examination office. 
              You will receive another email once your account has been reviewed.
            </p>
            <p style="color: #64748b; font-size: 13px; margin-top: 30px;">
              This typically takes 1-2 business days. Thank you for your patience!
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
        console.error('[registration] Failed to send confirmation email:', err);
      });

      notifyRole('SUPER_ADMIN', {
        type: 'APPROVAL_PENDING',
        title: 'New account awaits approval',
        message: `${user.fullName} (${user.email}) has registered and is awaiting approval.`,
        link: '/approvals',
        data: { userId: user.id },
      }).catch(() => {});

      broadcast.toRoles('SUPER_ADMIN', 'pending-account', {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      });
    }

    return user;
  },
};
