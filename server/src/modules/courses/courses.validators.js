import { z } from 'zod';

const courseStatus = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);

export const courseBaseSchema = z.object({
  code: z.string().trim().min(2).max(20),
  title: z.string().trim().min(2).max(150),
  departmentId: z.string().optional(),
  semesterId: z.string().min(1, 'Semester is required.'),
  level: z.coerce.number().int().min(100).max(900),
  creditHours: z.coerce.number().int().min(1).max(20),
  studentCount: z.coerce.number().int().min(0).optional(),
  examDurationMinutes: z.coerce.number().int().min(15).max(300).optional(),
  specialRequirements: z.string().trim().max(500).optional().nullable(),
  instructorName: z.string().trim().min(2, 'Instructor name is required.').max(120),
});

export const createCourseSchema = courseBaseSchema;

export const updateCourseSchema = courseBaseSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Provide at least one field to update.' }
);

export const listCoursesQuerySchema = z.object({
  departmentId: z.string().optional(),
  semesterId: z.string().optional(),
  status: courseStatus.optional(),
  level: z.coerce.number().int().optional(),
  q: z.string().trim().optional(),
}).optional();

export const approveCourseSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

export const rejectCourseSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

export const bulkImportCoursesSchema = z.object({
  semesterId: z.string().min(1, 'Semester is required.'),
  courses: z.array(z.object({
    code: z.string().trim().min(2).max(20),
    title: z.string().trim().min(2).max(150),
    departmentName: z.string().trim().min(2).max(100),
    level: z.coerce.number().int().min(100).max(900),
    creditHours: z.coerce.number().int().min(1).max(20).optional(),
    studentCount: z.coerce.number().int().min(0).optional(),
    examDurationMinutes: z.coerce.number().int().min(15).max(300).optional(),
    instructorName: z.string().trim().max(120).optional(),
  })).min(1, 'At least one course is required.').max(1000, 'Too many courses in one import.'),
});
