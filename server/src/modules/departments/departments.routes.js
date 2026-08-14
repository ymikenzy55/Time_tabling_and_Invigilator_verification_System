import { Router } from 'express';
import { departmentsController } from './departments.controller.js';
import {
  createDepartmentSchema, updateDepartmentSchema, listDepartmentsQuerySchema,
} from './departments.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

// Public endpoint used during activation to pick a department.
router.get('/public', departmentsController.listNames);

router.use(requireAuth);

router.get('/me', requireRole('DEPARTMENT_HEAD'), departmentsController.getMine);

router.use(requireRole('SUPER_ADMIN'));

router.get('/', validate(listDepartmentsQuerySchema, 'query'), departmentsController.list);
router.get('/:id', departmentsController.getOne);
router.post('/', validate(createDepartmentSchema), departmentsController.create);
router.patch('/:id', validate(updateDepartmentSchema), departmentsController.update);
router.delete('/:id', departmentsController.remove);

export default router;
