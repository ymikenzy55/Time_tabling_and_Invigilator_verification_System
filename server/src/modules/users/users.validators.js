import { z } from 'zod';

const roleEnum = z.enum(['SUPER_ADMIN', 'DEPARTMENT_HEAD', 'INVIGILATOR']);
const statusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING_APPROVAL', 'REJECTED', 'INVITED']);

/**
 * Strong password rules — keep in sync with client/src/lib/passwordRules.js
 */
const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .refine((v) => /[A-Z]/.test(v),      'Password must include an uppercase letter.')
  .refine((v) => /[a-z]/.test(v),      'Password must include a lowercase letter.')
  .refine((v) => /\d/.test(v),         'Password must include a number.')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must include a symbol.');

export const listUsersQuerySchema = z.object({
  role: roleEnum.optional(),
  status: statusEnum.optional(),
  q: z.string().trim().min(1).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  fullName: z.string().trim().min(2, 'Full name is required.'),
  staffId: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  role: roleEnum,
  password: strongPassword,
  departmentId: z.string().optional(),
});

export const createPeerDepartmentHeadSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  fullName: z.string().trim().min(2, 'Full name is required.'),
  staffId: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  password: strongPassword,
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  staffId: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  departmentId: z.string().nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: strongPassword,
}).refine((v) => v.currentPassword !== v.newPassword, {
  message: 'The new password must be different from your current password.',
  path: ['newPassword'],
});

export const rejectUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const setStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']),
});
