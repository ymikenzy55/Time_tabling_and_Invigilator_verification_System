import { z } from 'zod';

export const createSemesterSchema = z.object({
  name: z.string().trim().min(2).max(50),
  academicYearId: z.string().min(1, 'Academic year is required.'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.coerce.boolean().optional(),
}).refine((v) => v.endDate > v.startDate, {
  message: 'End date must be after the start date.',
  path: ['endDate'],
});

export const updateSemesterSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  academicYearId: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.coerce.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listSemestersQuerySchema = z.object({
  academicYearId: z.string().optional(),
}).optional();
