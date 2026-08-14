import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { notificationsController } from './notifications.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', notificationsController.list);
router.get('/unread-count', notificationsController.unreadCount);
router.post('/read-all', notificationsController.markAllRead);
router.post('/read-by-type', notificationsController.markByType);
router.post('/:id/read', notificationsController.markRead);

export default router;
