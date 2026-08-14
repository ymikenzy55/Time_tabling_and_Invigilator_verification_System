import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  confirm: z.string().min(1, 'Please confirm your password.'),
}).refine((v) => v.newPassword === v.confirm, {
  message: 'Passwords do not match.',
  path: ['confirm'],
});
