import { Router } from 'express';
import { courseLevelsController } from './courseLevels.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { createCourseLevelSchema, listCourseLevelsSchema } from './courseLevels.validators.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD'));

router.get('/', validate(listCourseLevelsSchema, 'query'), courseLevelsController.list);
router.post('/', validate(createCourseLevelSchema), courseLevelsController.create);
router.delete('/:id', courseLevelsController.remove);

export default router;
