import crypto from 'crypto';
import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword } from '../../utils/password.js';
import { sendEmail, isEmailConfigured } from '../../utils/email.js';
import { primaryClientOrigin } from '../../config/env.js';
import { logAudit } from '../../utils/auditLog.js';

const RESET_TOKEN_BYTES = 32;
const RESET_EXPIRY_HOURS = 1;

const generateToken = () => crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');

const buildResetLink = (token) => `${primaryClientOrigin}/reset-password?token=${token}`;

export const passwordResetService = {
  async requestReset({ email }) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Security: Don't reveal whether a user exists or not (prevents user enumeration)
    // Always return success, but only send email if user exists and is active
    if (!user || user.status !== 'ACTIVE') {
      // Log the attempt but return success to prevent user enumeration
      if (user) {
        logAudit({
          actorId: user.id,
          action: 'USER.PASSWORD_RESET_REQUEST_INACTIVE',
          targetType: 'User',
          targetId: user.id,
          result: 'FAILURE',
          metadata: { reason: 'Account not active' },
        });
      }
      
      // Return success message even though no email was sent (security best practice)
      return {
        message: 'If an account exists with that email, a password reset link has been sent.',
      };
    }

    // Invalidate any previous unused tokens for this user
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetLink = buildResetLink(token);

    // Send email asynchronously (fire-and-forget) to avoid blocking the response
    if (isEmailConfigured()) {
      // Use Promise.resolve().then() for better compatibility
      Promise.resolve().then(() => {
        sendEmail({
          to: user.email,
          subject: 'Password Reset — Examination Management System',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e293b;">Password Reset Request</h2>
              <p style="color: #475569; font-size: 15px;">
                Hello ${user.fullName},
              </p>
              <p style="color: #475569; font-size: 15px;">
                We received a request to reset your password. Click the button below to set a new password:
              </p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}"
                   style="background: #4f46e5; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Reset Password
                </a>
              </p>
              <p style="color: #64748b; font-size: 13px;">
                Or copy this link into your browser:<br>
                <a href="${resetLink}" style="color: #4f46e5; word-break: break-all;">${resetLink}</a>
              </p>
              <p style="color: #64748b; font-size: 13px;">
                This link will expire in ${RESET_EXPIRY_HOURS} hour${RESET_EXPIRY_HOURS === 1 ? '' : 's'}.<br>
                If you did not request a password reset, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              <p style="color: #94a3b8; font-size: 12px;">
                Examination Management System
              </p>
            </div>
          `,
        }).catch((err) => {
          console.error('[PasswordReset] Failed to send email:', err);
        });
      });
    }

    logAudit({
      actorId: user.id,
      action: 'USER.PASSWORD_RESET_REQUEST',
      targetType: 'User',
      targetId: user.id,
      result: 'SUCCESS',
    });

    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
      ...(isEmailConfigured() ? {} : { resetLink }),
    };
  },

  async confirmReset({ token, newPassword }) {
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord) {
      throw ApiError.badRequest('Invalid or expired reset token.');
    }

    if (resetRecord.used) {
      throw ApiError.badRequest('This reset link has already been used.');
    }

    if (new Date(resetRecord.expiresAt) < new Date()) {
      throw ApiError.badRequest('This reset link has expired. Please request a new one.');
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ]);

    logAudit({
      actorId: resetRecord.userId,
      action: 'USER.PASSWORD_RESET',
      targetType: 'User',
      targetId: resetRecord.userId,
      result: 'SUCCESS',
    });

    return { message: 'Your password has been reset successfully.' };
  },
};
