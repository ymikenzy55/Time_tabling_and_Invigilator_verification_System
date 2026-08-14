import { z } from 'zod';

export const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required.').max(120),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1.').max(100000),
  location: z.string().max(200).optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

export const updateVenueSchema = createVenueSchema.partial();

export const bulkImportVenuesSchema = z.object({
  venues: z.array(createVenueSchema).min(1, 'At least one venue is required.').max(500, 'Too many venues in one import.'),
});
