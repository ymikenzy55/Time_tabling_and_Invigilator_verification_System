import { Router } from 'express';
import { academicYearsController } from './academicYears.controller.js';
import { createAcademicYearSchema, updateAcademicYearSchema } from './academicYears.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', academicYearsController.list);

router.use(requireRole('SUPER_ADMIN'));
router.get('/:id', academicYearsController.getOne);
router.post('/', validate(createAcademicYearSchema), academicYearsController.create);
router.patch('/:id', validate(updateAcademicYearSchema), academicYearsController.update);
router.delete('/:id', academicYearsController.remove);

export default router;
