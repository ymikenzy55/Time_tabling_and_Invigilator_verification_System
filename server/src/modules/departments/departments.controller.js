import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { departmentsService } from './departments.service.js';

export const departmentsController = {
  listNames: asyncHandler(async (_req, res) => {
    const departments = await departmentsService.listNames();
    return ApiResponse.ok(res, { departments });
  }),

  getMine: asyncHandler(async (req, res) => {
    const result = await departmentsService.getForDepartmentHead(req.user);
    return ApiResponse.ok(res, result);
  }),

  list: asyncHandler(async (req, res) => {
    const departments = await departmentsService.list(req.query);
    return ApiResponse.ok(res, { departments });
  }),

  getOne: asyncHandler(async (req, res) => {
    const department = await departmentsService.getById(req.params.id);
    return ApiResponse.ok(res, { department });
  }),

  create: asyncHandler(async (req, res) => {
    const department = await departmentsService.create(req.body, req.user);
    return ApiResponse.created(res, { department });
  }),

  update: asyncHandler(async (req, res) => {
    const department = await departmentsService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { department });
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await departmentsService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, result);
  }),
};
