import { z } from 'zod';

const roleEnum = z.enum(['DEPARTMENT_HEAD', 'INVIGILATOR']);

const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .refine((v) => /[A-Z]/.test(v), 'Password must include an uppercase letter.')
  .refine((v) => /[a-z]/.test(v), 'Password must include a lowercase letter.')
  .refine((v) => /\d/.test(v), 'Password must include a number.')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must include a symbol.');

export const setWindowSchema = z.object({
  opensAt: z.string().min(1, 'Start date is required.'),
  closesAt: z.string().min(1, 'End date is required.'),
});

export const registerSchema = z.object({
  role: roleEnum,
  email: z.string().email('Please enter a valid email address.'),
  fullName: z.string().trim().min(2, 'Full name is required.'),
  staffId: z.string().trim().min(1, 'Staff ID is required.'),
  phone: z.string().trim().optional(),
  password: strongPassword,
  departmentName: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.role === 'DEPARTMENT_HEAD' && !value.departmentName) {
    ctx.addIssue({
      path: ['departmentName'],
      code: z.ZodIssueCode.custom,
      message: 'Department name is required for department heads.',
    });
  }
  if (value.role === 'INVIGILATOR' && !value.departmentName) {
    ctx.addIssue({
      path: ['departmentName'],
      code: z.ZodIssueCode.custom,
      message: 'Department name is required for invigilators.',
    });
  }
});

export const sendVerificationCodeSchema = z.object({
  role: roleEnum,
  email: z.string().email('Please enter a valid email address.'),
});

export const verifyAndRegisterSchema = z.object({
  role: roleEnum,
  email: z.string().email('Please enter a valid email address.'),
  fullName: z.string().trim().min(2, 'Full name is required.'),
  staffId: z.string().trim().min(1, 'Staff ID is required.'),
  phone: z.string().trim().optional(),
  password: strongPassword,
  departmentName: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  verificationCode: z.string().trim().length(6, 'Verification code must be 6 digits.'),
}).superRefine((value, ctx) => {
  if (value.role === 'DEPARTMENT_HEAD' && !value.departmentName) {
    ctx.addIssue({
      path: ['departmentName'],
      code: z.ZodIssueCode.custom,
      message: 'Department name is required for department heads.',
    });
  }
  if (value.role === 'INVIGILATOR' && !value.departmentName) {
    ctx.addIssue({
      path: ['departmentName'],
      code: z.ZodIssueCode.custom,
      message: 'Department name is required for invigilators.',
    });
  }
});

export const roleParamSchema = z.object({
  role: roleEnum,
});
