import { z } from 'zod';

export const attendanceSchemas = {
  scan: z.object({
    token: z.string().min(1, 'QR token is required.'),
  }),
};
