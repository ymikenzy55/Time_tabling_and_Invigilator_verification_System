import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { venuesService } from './venues.service.js';

export const venuesController = {
  list: asyncHandler(async (req, res) => {
    const venues = await venuesService.list({ activeOnly: req.query.activeOnly === 'true' });
    return ApiResponse.ok(res, { venues });
  }),

  getOne: asyncHandler(async (req, res) => {
    const venue = await venuesService.getById(req.params.id);
    return ApiResponse.ok(res, { venue });
  }),

  create: asyncHandler(async (req, res) => {
    const venue = await venuesService.create(req.body, req.user);
    return ApiResponse.created(res, { venue });
  }),

  bulkImport: asyncHandler(async (req, res) => {
    const result = await venuesService.bulkImport(req.body.venues, req.user);
    return ApiResponse.created(res, result);
  }),

  update: asyncHandler(async (req, res) => {
    const venue = await venuesService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { venue });
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await venuesService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, result);
  }),
};
