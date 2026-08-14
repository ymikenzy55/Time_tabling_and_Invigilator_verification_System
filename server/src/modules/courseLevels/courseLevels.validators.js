import { z } from 'zod';

export const listCourseLevelsSchema = z.object({
  departmentId: z.string().cuid().optional(),
});

export const createCourseLevelSchema = z.object({
  value: z.coerce.number().int('Level must be a whole number.').positive('Level must be positive.'),
  label: z.string().trim().min(1).max(50).optional(),
  departmentId: z.string().cuid().optional(),
});
