import { z } from 'zod';

export const createAcademicYearSchema = z.object({
  name: z.string().trim().min(2).max(50),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.coerce.boolean().optional(),
}).refine((v) => v.endDate > v.startDate, {
  message: 'End date must be after the start date.',
  path: ['endDate'],
});

export const updateAcademicYearSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.coerce.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });
