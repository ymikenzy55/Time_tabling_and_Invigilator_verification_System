import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { dashboardController } from './dashboard.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/summary', dashboardController.summary);

export default router;
