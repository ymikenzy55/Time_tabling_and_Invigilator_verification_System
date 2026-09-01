import { Router } from 'express';
import { authController } from './auth.controller.js';
import { passwordResetController } from './passwordReset.controller.js';
import { emailVerificationController } from './emailVerification.controller.js';
import {
  loginSchema, forgotPasswordSchema, resetPasswordSchema,
} from './auth.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { z } from 'zod';

const emailVerificationSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  code: z.string().length(6, 'Verification code must be 6 digits.'),
});

const sendCodeSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), passwordResetController.requestReset);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), passwordResetController.confirmReset);

// Email verification routes
router.post('/send-verification-code', authLimiter, validate(sendCodeSchema), emailVerificationController.sendCode);
router.post('/verify-email', authLimiter, validate(emailVerificationSchema), emailVerificationController.verifyCode);
router.post('/resend-verification-code', authLimiter, validate(sendCodeSchema), emailVerificationController.resendCode);

router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);

export default router;
