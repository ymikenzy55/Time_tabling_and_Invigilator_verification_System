import { Router } from 'express';
import { coursesController } from './courses.controller.js';
import {
  createCourseSchema, updateCourseSchema, listCoursesQuerySchema,
  approveCourseSchema, rejectCourseSchema, bulkImportCoursesSchema,
} from './courses.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

// Super Admin and Department Heads can create courses; Department Heads can only manage their own department.
router.use(requireAuth, requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD'));

router.get('/', validate(listCoursesQuerySchema, 'query'), coursesController.list);
router.post('/approve-all', requireRole('SUPER_ADMIN'), coursesController.approveAll);
router.post('/import', validate(bulkImportCoursesSchema), coursesController.bulkImport);
router.get('/:id', coursesController.getOne);
router.post('/', validate(createCourseSchema), coursesController.create);
router.patch('/:id', validate(updateCourseSchema), coursesController.update);
router.post('/:id/submit', coursesController.submit);
router.delete('/:id', coursesController.remove);

// Approval/rejection is Super Admin only
router.post('/:id/approve', requireRole('SUPER_ADMIN'), validate(approveCourseSchema), coursesController.approve);
router.post('/:id/reject', requireRole('SUPER_ADMIN'), validate(rejectCourseSchema), coursesController.reject);

export default router;
