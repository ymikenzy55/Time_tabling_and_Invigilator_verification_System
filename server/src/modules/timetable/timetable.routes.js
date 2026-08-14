import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { timetableSchemas } from './timetable.validators.js';
import { timetableController } from './timetable.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/initial', requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR'), timetableController.initialData);
router.get('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR'), timetableController.list);
router.post('/generate', requireRole('SUPER_ADMIN'), validate(timetableSchemas.generate), timetableController.generate);
router.get('/readiness/:examinationSessionId', requireRole('SUPER_ADMIN'), timetableController.readiness);
router.patch('/entries/:entryId', requireRole('SUPER_ADMIN'), validate(timetableSchemas.updateEntry), timetableController.updateEntry);
router.delete('/entries/:entryId', requireRole('SUPER_ADMIN'), timetableController.deleteEntry);
router.delete('/:examinationSessionId', requireRole('SUPER_ADMIN'), timetableController.deleteTimetable);

export default router;
