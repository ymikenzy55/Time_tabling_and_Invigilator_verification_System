import { z } from 'zod';

const facultyCode = z.string().trim().min(2).max(10);
const facultyName = z.string().trim().min(2).max(100);

export const createFacultySchema = z.object({
  name: facultyName,
  code: facultyCode,
});

export const updateFacultySchema = z.object({
  name: facultyName.optional(),
  code: facultyCode.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listFacultiesQuerySchema = z.object({
  q: z.string().trim().optional(),
}).optional();
