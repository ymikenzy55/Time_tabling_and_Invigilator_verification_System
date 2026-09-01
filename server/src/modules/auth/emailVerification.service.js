import crypto from 'crypto';
import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendEmail, isEmailConfigured } from '../../utils/email.js';

const CODE_EXPIRY_MINUTES = 1;
const MAX_ATTEMPTS = 5;

const generateCode = () => {
  // Generate a 6-digit code
  return crypto.randomInt(100000, 999999).toString();
};

export const emailVerificationService = {
  /**
   * Send verification code to email
   */
  async sendVerificationCode(email) {
    // Invalidate any previous unused codes for this email
    await prisma.emailVerification.updateMany({
      where: { email, verified: false },
      data: { verified: true }, // Mark as used
    });

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.emailVerification.create({
      data: { email, code, expiresAt },
    });

    // Send email with verification code (fire-and-forget)
    if (isEmailConfigured()) {
      sendEmail({
        to: email,
        subject: 'Email Verification — UENR Exam System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1e293b;">Email Verification</h2>
            <p style="color: #475569; font-size: 15px;">
              Thank you for registering with the UENR Examination Management System.
            </p>
            <p style="color: #475569; font-size: 15px;">
              To complete your registration, please enter the verification code below:
            </p>
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px; border: 2px dashed #cbd5e1;">
              <div style="font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${code}
              </div>
            </div>
            <p style="color: #64748b; font-size: 13px;">
              This code will expire in ${CODE_EXPIRY_MINUTES} minute${CODE_EXPIRY_MINUTES === 1 ? '' : 's'}.<br>
              If you did not request this verification, you can safely ignore this email.
            </p>
            <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
              <strong>Note:</strong> After verifying your email, your account will be sent to the exam officer for approval before you can log in.
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              UENR Examination Management System
            </p>
          </div>
        `,
      }).catch((err) => {
        console.error('[EmailVerification] Failed to send email:', err);
      });
    }

    return {
      message: isEmailConfigured()
        ? 'A verification code has been sent to your email.'
        : 'Verification code created.',
      expiresAt,
      ...(isEmailConfigured() ? {} : { code }), // Only return code if email not configured (for testing)
    };
  },

  /**
   * Verify email with code
   */
  async verifyCode(email, code) {
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        code,
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw ApiError.badRequest('Invalid verification code.');
    }

    // Check if expired
    if (new Date(verification.expiresAt) < new Date()) {
      throw ApiError.badRequest('Verification code has expired. Please request a new one.');
    }

    // Check attempts
    if (verification.attempts >= MAX_ATTEMPTS) {
      throw ApiError.badRequest('Too many attempts. Please request a new verification code.');
    }

    // Increment attempts
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: {
        attempts: verification.attempts + 1,
        verified: true, // Mark as verified
      },
    });

    return {
      message: 'Email verified successfully.',
      verified: true,
    };
  },

  /**
   * Check if email is verified
   */
  async isEmailVerified(email) {
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        verified: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return !!verification;
  },

  /**
   * Resend verification code
   */
  async resendCode(email) {
    // Check rate limiting (don't send more than once per minute)
    const recentCode = await prisma.emailVerification.findFirst({
      where: {
        email,
        createdAt: { gte: new Date(Date.now() - 60 * 1000) }, // Last minute
      },
    });

    if (recentCode) {
      throw ApiError.badRequest('Please wait a minute before requesting a new code.');
    }

    return this.sendVerificationCode(email);
  },
};
