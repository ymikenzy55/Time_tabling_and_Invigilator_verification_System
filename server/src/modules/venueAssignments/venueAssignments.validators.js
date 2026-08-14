import { z } from 'zod';

export const venueAssignmentSchemas = {
  assign: z.object({
    examinationSessionId: z.string().min(1, 'Examination session is required.'),
    maxPerVenue: z.number().int().min(1).max(10).optional(),
  }),
  manualAssign: z.object({
    examinationSessionId: z.string().min(1, 'Examination session is required.'),
    venueId: z.string().min(1, 'Venue is required.'),
    invigilatorId: z.string().min(1, 'Invigilator is required.'),
    slotAt: z.string().min(1, 'Time slot is required.'),
  }),
};
