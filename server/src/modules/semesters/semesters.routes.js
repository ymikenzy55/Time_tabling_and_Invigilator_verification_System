import { Router } from 'express';
import { semestersController } from './semesters.controller.js';
import { createSemesterSchema, updateSemesterSchema, listSemestersQuerySchema } from './semesters.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD'), validate(listSemestersQuerySchema, 'query'), semestersController.list);
router.post('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD'), validate(createSemesterSchema), semestersController.create);

router.get('/:id', requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD'), semestersController.getOne);
router.patch('/:id', requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD'), validate(updateSemesterSchema), semestersController.update);
router.delete('/:id', requireRole('SUPER_ADMIN'), semestersController.remove);

export default router;
