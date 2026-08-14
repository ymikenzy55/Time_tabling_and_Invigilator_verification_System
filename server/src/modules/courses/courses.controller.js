import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { coursesService } from './courses.service.js';

export const coursesController = {
  list: asyncHandler(async (req, res) => {
    const courses = await coursesService.list(req.query, req.user);
    return ApiResponse.ok(res, { courses });
  }),

  getOne: asyncHandler(async (req, res) => {
    const course = await coursesService.getById(req.params.id, req.user);
    return ApiResponse.ok(res, { course });
  }),

  create: asyncHandler(async (req, res) => {
    const course = await coursesService.create(req.body, req.user);
    return ApiResponse.created(res, { course });
  }),

  bulkImport: asyncHandler(async (req, res) => {
    const result = await coursesService.bulkImport(req.body, req.user);
    return ApiResponse.created(res, result);
  }),

  update: asyncHandler(async (req, res) => {
    const course = await coursesService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { course });
  }),

  submit: asyncHandler(async (req, res) => {
    const course = await coursesService.submit(req.params.id, req.user);
    return ApiResponse.ok(res, { course });
  }),

  approve: asyncHandler(async (req, res) => {
    const course = await coursesService.approve(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { course });
  }),

  approveAll: asyncHandler(async (req, res) => {
    const result = await coursesService.approveAll(req.body.ids || [], req.user);
    return ApiResponse.ok(res, result);
  }),

  reject: asyncHandler(async (req, res) => {
    const course = await coursesService.reject(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { course });
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await coursesService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, result);
  }),
};
