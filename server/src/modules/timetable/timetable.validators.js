import { z } from 'zod';

export const timetableSchemas = {
  generate: z.object({
    examinationSessionId: z.string().min(1, 'Examination session is required.'),
    options: z.object({
      semesterId: z.string().optional(), // Allowed but not used (session already has semester)
      startDate: z.string().min(1).optional(),
      endDate: z.string().min(1).optional(),
      durationDays: z.coerce.number().int().min(1).max(365).optional(),
      skipWeekends: z.coerce.boolean().optional(),
      clearExisting: z.coerce.boolean().optional(),
      assignVenues: z.coerce.boolean().optional(),
      maxRetries: z.coerce.number().int().min(1).max(100).optional(),
    }).optional(),
  }),

  updateEntry: z.object({
    venueId: z.string().min(1).optional(),
    scheduledAt: z.string().min(1).optional(),
  }),
};
