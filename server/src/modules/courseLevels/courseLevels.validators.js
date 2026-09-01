import { z } from 'zod';

export const listCourseLevelsSchema = z.object({
  departmentId: z.string().min(1).optional(),
}).passthrough(); // Allow additional query params

export const createCourseLevelSchema = z.object({
  value: z.coerce.number().int('Level must be a whole number.').positive('Level must be positive.'),
  label: z.string().trim().min(1).max(50).optional(),
  departmentId: z.string().min(1).optional(),
});
