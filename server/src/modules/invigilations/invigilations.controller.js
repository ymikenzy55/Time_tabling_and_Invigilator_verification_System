import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { invigilationsService } from './invigilations.service.js';

export const invigilationsController = {
  list: asyncHandler(async (req, res) => {
    const invigilations = await invigilationsService.list(req.query, req.user);
    return ApiResponse.ok(res, { invigilations });
  }),

  myAssignments: asyncHandler(async (req, res) => {
    const invigilations = await invigilationsService.list({ invigilatorId: req.user.id }, req.user);
    return ApiResponse.ok(res, { invigilations });
  }),

  getOne: asyncHandler(async (req, res) => {
    const invigilation = await invigilationsService.getById(req.params.id, req.user);
    return ApiResponse.ok(res, { invigilation });
  }),

  create: asyncHandler(async (req, res) => {
    const invigilation = await invigilationsService.create(req.body, req.user);
    return ApiResponse.created(res, { invigilation });
  }),

  update: asyncHandler(async (req, res) => {
    const invigilation = await invigilationsService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { invigilation });
  }),

  replace: asyncHandler(async (req, res) => {
    const invigilation = await invigilationsService.replace(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { invigilation });
  }),

  remove: asyncHandler(async (req, res) => {
    await invigilationsService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, { message: 'Invigilation assignment removed.' });
  }),
};
