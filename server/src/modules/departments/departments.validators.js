import { z } from 'zod';

const departmentCode = z.string().trim().min(2).max(15);
const departmentName = z.string().trim().min(2).max(100);

export const createDepartmentSchema = z.object({
  name: departmentName,
  code: departmentCode,
});

export const updateDepartmentSchema = z.object({
  name: departmentName.optional(),
  code: departmentCode.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listDepartmentsQuerySchema = z.object({
  q: z.string().trim().optional(),
}).optional();
