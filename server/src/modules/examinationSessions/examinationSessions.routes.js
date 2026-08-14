import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { examinationSessionSchemas } from './examinationSessions.validators.js';
import { examinationSessionsController } from './examinationSessions.controller.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/', examinationSessionsController.list);
router.get('/:id', examinationSessionsController.getOne);
router.post('/', validate(examinationSessionSchemas.create), examinationSessionsController.create);
router.patch('/:id', validate(examinationSessionSchemas.update), examinationSessionsController.update);
router.delete('/:id', examinationSessionsController.remove);

export default router;
