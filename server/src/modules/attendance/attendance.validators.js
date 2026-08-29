import { z } from 'zod';

export const attendanceSchemas = {
  scan: z.object({
    token: z.string().min(1, 'QR token is required.'),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    locationAccuracy: z.number().optional(),
  }),
};
