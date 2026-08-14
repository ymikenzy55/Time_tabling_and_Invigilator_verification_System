import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { facultiesService } from './faculties.service.js';

export const facultiesController = {
  list: asyncHandler(async (req, res) => {
    const faculties = await facultiesService.list(req.query);
    return ApiResponse.ok(res, { faculties });
  }),

  getOne: asyncHandler(async (req, res) => {
    const faculty = await facultiesService.getById(req.params.id);
    return ApiResponse.ok(res, { faculty });
  }),

  create: asyncHandler(async (req, res) => {
    const faculty = await facultiesService.create(req.body, req.user);
    return ApiResponse.created(res, { faculty });
  }),

  update: asyncHandler(async (req, res) => {
    const faculty = await facultiesService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { faculty });
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await facultiesService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, result);
  }),
};
