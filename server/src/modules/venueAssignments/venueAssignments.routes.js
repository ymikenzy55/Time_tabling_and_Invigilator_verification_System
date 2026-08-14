import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { venueAssignmentSchemas } from './venueAssignments.validators.js';
import { venueAssignmentsController } from './venueAssignments.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/assign', requireRole('SUPER_ADMIN'), validate(venueAssignmentSchemas.assign), venueAssignmentsController.assign);
router.post('/manual-assign', requireRole('SUPER_ADMIN'), validate(venueAssignmentSchemas.manualAssign), venueAssignmentsController.manualAssign);
router.delete('/:id', requireRole('SUPER_ADMIN'), venueAssignmentsController.removeAssignment);
router.get('/', venueAssignmentsController.list);
router.get('/my', requireRole('INVIGILATOR'), venueAssignmentsController.myAssignments);
router.get('/invigilator-count', venueAssignmentsController.invigilatorCount);

export default router;
