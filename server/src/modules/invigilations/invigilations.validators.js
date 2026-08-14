import { z } from 'zod';

export const invigilationSchemas = {
  create: z.object({
    examinationSessionId: z.string().min(1, 'Examination session is required.'),
    courseId: z.string().min(1, 'Course is required.'),
    invigilatorId: z.string().min(1, 'Invigilator is required.'),
    scheduledAt: z.string().min(1, 'Scheduled date and time is required.'),
    windowOpensAt: z.string().optional(),
    windowClosesAt: z.string().optional(),
    gracePeriodMin: z.coerce.number().int().min(0).default(0),
  }).refine((v) => !v.windowOpensAt || !v.windowClosesAt || new Date(v.windowClosesAt) > new Date(v.windowOpensAt), {
    message: 'Window close time must be after open time.',
    path: ['windowClosesAt'],
  }),

  update: z.object({
    examinationSessionId: z.string().optional(),
    courseId: z.string().optional(),
    invigilatorId: z.string().optional(),
    scheduledAt: z.string().optional(),
    windowOpensAt: z.string().optional(),
    windowClosesAt: z.string().optional(),
    gracePeriodMin: z.coerce.number().int().min(0).optional(),
    isActive: z.coerce.boolean().optional(),
  }).refine((v) => !v.windowOpensAt || !v.windowClosesAt || new Date(v.windowClosesAt) > new Date(v.windowOpensAt), {
    message: 'Window close time must be after open time.',
    path: ['windowClosesAt'],
  }),

  replace: z.object({
    replacementId: z.string().min(1, 'Replacement invigilator is required.'),
  }),
};
