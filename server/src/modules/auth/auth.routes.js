import { Router } from 'express';
import { authController } from './auth.controller.js';
import { passwordResetController } from './passwordReset.controller.js';
import {
  loginSchema, forgotPasswordSchema, resetPasswordSchema,
} from './auth.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), passwordResetController.requestReset);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), passwordResetController.confirmReset);
router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);

export default router;
