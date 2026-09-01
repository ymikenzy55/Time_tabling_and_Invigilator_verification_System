import { Router } from 'express';
import { registrationController } from './registration.controller.js';
import { setWindowSchema, registerSchema } from './registration.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

// Public endpoints used by the login/register page.
router.get('/status', registrationController.status);
router.get('/check-staff-id', registrationController.checkStaffId);
router.get('/check-email', registrationController.checkEmail);
router.post('/', validate(registerSchema), registrationController.register);

// Admin-only management of the windows.
router.use(requireAuth, requireRole('SUPER_ADMIN'));
router.get('/windows', registrationController.listWindows);
router.put('/windows/:role', validate(setWindowSchema), registrationController.setWindow);
router.delete('/windows/:role', registrationController.closeWindow);

export default router;
