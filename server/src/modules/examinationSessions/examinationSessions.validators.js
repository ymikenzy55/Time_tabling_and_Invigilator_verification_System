import { z } from 'zod';

export const examinationSessionSchemas = {
  create: z.object({
    name: z.string().trim().min(2, 'Name is required.'),
    semesterId: z.string().min(1, 'Semester is required.'),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string().min(1, 'End date is required.'),
    isPublished: z.coerce.boolean().optional(),
  }).refine((v) => new Date(v.endDate) > new Date(v.startDate), {
    message: 'End date must be after start date.',
    path: ['endDate'],
  }),

  update: z.object({
    name: z.string().trim().min(2).optional(),
    semesterId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isPublished: z.coerce.boolean().optional(),
  }).refine((v) => !v.startDate || !v.endDate || new Date(v.endDate) > new Date(v.startDate), {
    message: 'End date must be after start date.',
    path: ['endDate'],
  }),
};
