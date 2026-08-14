import { Router } from 'express';
import { venuesController } from './venues.controller.js';
import { createVenueSchema, updateVenueSchema, bulkImportVenuesSchema } from './venues.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR'), venuesController.list);
router.post('/', requireRole('SUPER_ADMIN'), validate(createVenueSchema), venuesController.create);
router.post('/import', requireRole('SUPER_ADMIN'), validate(bulkImportVenuesSchema), venuesController.bulkImport);

router.get('/:id', requireRole('SUPER_ADMIN'), venuesController.getOne);
router.patch('/:id', requireRole('SUPER_ADMIN'), validate(updateVenueSchema), venuesController.update);
router.delete('/:id', requireRole('SUPER_ADMIN'), venuesController.remove);

export default router;
