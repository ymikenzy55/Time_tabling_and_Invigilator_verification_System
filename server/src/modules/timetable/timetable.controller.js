import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { timetableService } from './timetable.service.js';

export const timetableController = {
  initialData: asyncHandler(async (req, res) => {
    const result = await timetableService.initialData(req.user);
    return ApiResponse.ok(res, result);
  }),

  generate: asyncHandler(async (req, res) => {
    const result = await timetableService.generate(req.body.examinationSessionId, req.body.options || {}, req.user);
    return ApiResponse.ok(res, result);
  }),

  readiness: asyncHandler(async (req, res) => {
    const result = await timetableService.readiness(req.params.examinationSessionId, req.user);
    return ApiResponse.ok(res, result);
  }),

  list: asyncHandler(async (req, res) => {
    const entries = await timetableService.list(req.query, req.user);
    return ApiResponse.ok(res, { entries });
  }),

  updateEntry: asyncHandler(async (req, res) => {
    const result = await timetableService.updateEntry(req.params.entryId, req.body, req.user);
    return ApiResponse.ok(res, result);
  }),

  deleteEntry: asyncHandler(async (req, res) => {
    const result = await timetableService.deleteEntry(req.params.entryId, req.user);
    return ApiResponse.ok(res, result);
  }),

  deleteTimetable: asyncHandler(async (req, res) => {
    const result = await timetableService.deleteTimetable(req.params.examinationSessionId, req.user);
    return ApiResponse.ok(res, result);
  }),
};
