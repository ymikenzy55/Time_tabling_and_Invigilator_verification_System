import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { semestersService } from './semesters.service.js';

export const semestersController = {
  list: asyncHandler(async (req, res) => {
    const semesters = await semestersService.list(req.query);
    return ApiResponse.ok(res, { semesters });
  }),

  getOne: asyncHandler(async (req, res) => {
    const semester = await semestersService.getById(req.params.id);
    return ApiResponse.ok(res, { semester });
  }),

  create: asyncHandler(async (req, res) => {
    const semester = await semestersService.create(req.body, req.user);
    return ApiResponse.created(res, { semester });
  }),

  update: asyncHandler(async (req, res) => {
    const semester = await semestersService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { semester });
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await semestersService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, result);
  }),
};
