import { Router } from 'express';
import { facultiesController } from './faculties.controller.js';
import { createFacultySchema, updateFacultySchema, listFacultiesQuerySchema } from './faculties.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

router.use(requireAuth, requireRole('SUPER_ADMIN'));

router.get('/', validate(listFacultiesQuerySchema, 'query'), facultiesController.list);
router.get('/:id', facultiesController.getOne);
router.post('/', validate(createFacultySchema), facultiesController.create);
router.patch('/:id', validate(updateFacultySchema), facultiesController.update);
router.delete('/:id', facultiesController.remove);

export default router;
