import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { academicYearsService } from './academicYears.service.js';

export const academicYearsController = {
  list: asyncHandler(async (req, res) => {
    const academicYears = await academicYearsService.list();
    return ApiResponse.ok(res, { academicYears });
  }),

  getOne: asyncHandler(async (req, res) => {
    const academicYear = await academicYearsService.getById(req.params.id);
    return ApiResponse.ok(res, { academicYear });
  }),

  create: asyncHandler(async (req, res) => {
    const academicYear = await academicYearsService.create(req.body, req.user);
    return ApiResponse.created(res, { academicYear });
  }),

  update: asyncHandler(async (req, res) => {
    const academicYear = await academicYearsService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { academicYear });
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await academicYearsService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, result);
  }),
};
