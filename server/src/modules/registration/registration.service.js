import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/password.js';
import { notifyRole } from '../notifications/notifications.service.js';
import { logAudit } from '../../utils/auditLog.js';
import { broadcast } from '../../utils/broadcast.js';
import { cache } from '../../utils/cache.js';
import { courseLevelsService } from '../courseLevels/courseLevels.service.js';
import { normalizeDepartmentName, linkDepartmentToUser } from '../departments/departmentAutoLink.js';
import { sendEmail, isEmailConfigured } from '../../utils/email.js';
import { primaryClientOrigin } from '../../config/env.js';
import crypto from 'crypto';

const OPEN_ROLES = ['DEPARTMENT_HEAD', 'INVIGILATOR'];
const VERIFICATION_CODE_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

const generate6DigitCode = () => {
  const bytes = crypto.randomBytes(3);
  const num = (bytes[0] << 16 | bytes[1] << 8 | bytes[2]) % 1000000;
  return String(num).padStart(6, '0');
};

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

  /** PUBLIC: send a 6-digit verification code to the user's email. */
  async sendVerificationCode(payload) {
    const { role, email } = payload;

    if (!OPEN_ROLES.includes(role)) {
      throw ApiError.badRequest('This role cannot register through the login page.');
    }

    const window = await prisma.registrationWindow.findUnique({ where: { role } });
    if (!isOpen(window)) {
      throw ApiError.badRequest('Registration for this role is not currently open.');
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw ApiError.conflict('An account with this email already exists.');
    }

    if (!isEmailConfigured()) {
      throw ApiError.badRequest('Email service is not configured. Please contact the exam office.');
    }

    // Invalidate previous unused codes for this email
    await prisma.emailVerification.updateMany({
      where: { email, verified: false },
      data: { verified: true },
    });

    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.emailVerification.create({
      data: { email, code, expiresAt },
    });

    setImmediate(() => {
      sendEmail({
        to: email,
        subject: 'Your Verification Code — UENR Examination System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 22px;">Email Verification</h2>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="color: #374151; font-size: 15px;">
                Use the code below to verify your email and complete your registration.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; background: white; border: 2px solid #4f46e5; border-radius: 12px; padding: 20px 40px;">
                  <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e293b; font-family: 'Courier New', monospace;">${code}</span>
                </div>
              </div>
              <p style="color: #6b7280; font-size: 13px; text-align: center;">
                This code expires in ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes.<br>
                If you did not request this, you can safely ignore this email.
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              University of Energy and Natural Resources<br>
              Examination Management System
            </p>
          </div>
        `,
      }).then((result) => {
        if (result?.success) {
          console.log('[registration] Verification code sent to', email, 'via', result.method);
        } else {
          console.error('[registration] Email send failed:', result?.error || 'unknown error');
        }
      }).catch((err) => {
        console.error('[registration] Failed to send verification code:', err.message || err);
      });
    });

    return { message: 'A 6-digit verification code has been sent to your email.', expiresAt };
  },

  /** PUBLIC: verify the code and create the user account. */
  async verifyAndRegister(payload) {
    const {
      role, email, fullName, staffId, phone, password, departmentName, departmentId,
      verificationCode,
    } = payload;

    if (!OPEN_ROLES.includes(role)) {
      throw ApiError.badRequest('This role cannot register through the login page.');
    }

    if (!verificationCode || verificationCode.length !== 6) {
      throw ApiError.badRequest('Please enter the 6-digit verification code.');
    }

    // Look up the most recent unused code for this email
    const record = await prisma.emailVerification.findFirst({
      where: { email, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw ApiError.badRequest('No verification code found. Please request a new code.');
    }

    if (new Date(record.expiresAt) < new Date()) {
      throw ApiError.badRequest('Your verification code has expired. Please request a new one.');
    }

    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await prisma.emailVerification.update({
        where: { id: record.id },
        data: { verified: true },
      });
      throw ApiError.badRequest('Too many incorrect attempts. Please request a new verification code.');
    }

    if (record.code !== verificationCode) {
      await prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: record.attempts + 1 },
      });
      const remaining = MAX_VERIFICATION_ATTEMPTS - (record.attempts + 1);
      throw ApiError.badRequest(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect code. Please request a new verification code.'
      );
    }

    // Code is correct — mark as verified
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    // Now proceed with the actual registration (same logic as register())
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
