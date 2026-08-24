import { Router } from 'express';
import { usersController } from './users.controller.js';
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  rejectUserSchema,
  setStatusSchema,
  createPeerDepartmentHeadSchema,
  createDelegateSchema,
} from './users.validators.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

// Every authenticated user can change their own password
router.post(
  '/me/change-password',
  validate(changePasswordSchema),
  usersController.changeMyPassword,
);

// Department Head peer management
router.get(
  '/department-heads/peers',
  requireRole('DEPARTMENT_HEAD'),
  usersController.listPeerDepartmentHeads,
);

router.post(
  '/department-heads',
  requireRole('DEPARTMENT_HEAD'),
  validate(createPeerDepartmentHeadSchema),
  usersController.createPeerDepartmentHead,
);

// Invigilator delegate creation
router.post(
  '/delegate',
  requireRole('INVIGILATOR'),
  validate(createDelegateSchema),
  usersController.createDelegate,
);

// Everything below this line is Super Admin only
router.use(requireRole('SUPER_ADMIN'));

router.get('/approvals/pending', usersController.listPendingApprovals);
router.post('/approvals/:id/approve', usersController.approveUser);
router.post('/approvals/:id/reject', validate(rejectUserSchema), usersController.rejectUser);

router.get('/', validate(listUsersQuerySchema, 'query'), usersController.list);
router.get('/:id', usersController.getOne);
router.post('/', validate(createUserSchema), usersController.create);
router.patch('/:id', validate(updateUserSchema), usersController.update);
router.delete('/:id', usersController.remove);

router.patch('/:id/status', validate(setStatusSchema), usersController.setStatus);

export default router;
