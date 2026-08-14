import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { invigilationSchemas } from './invigilations.validators.js';
import { invigilationsController } from './invigilations.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/my', requireRole('INVIGILATOR'), invigilationsController.myAssignments);

router.use(requireRole('SUPER_ADMIN'));

router.get('/', invigilationsController.list);
router.get('/:id', invigilationsController.getOne);
router.post('/', validate(invigilationSchemas.create), invigilationsController.create);
router.patch('/:id', validate(invigilationSchemas.update), invigilationsController.update);
router.post('/:id/replace', validate(invigilationSchemas.replace), invigilationsController.replace);
router.delete('/:id', invigilationsController.remove);

export default router;
