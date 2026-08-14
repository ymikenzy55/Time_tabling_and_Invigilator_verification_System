import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { examinationSessionsService } from './examinationSessions.service.js';

export const examinationSessionsController = {
  list: asyncHandler(async (req, res) => {
    const sessions = await examinationSessionsService.list(req.query);
    return ApiResponse.ok(res, { examinationSessions: sessions });
  }),

  getOne: asyncHandler(async (req, res) => {
    const session = await examinationSessionsService.getById(req.params.id);
    return ApiResponse.ok(res, { examinationSession: session });
  }),

  create: asyncHandler(async (req, res) => {
    const session = await examinationSessionsService.create(req.body, req.user);
    return ApiResponse.created(res, { examinationSession: session });
  }),

  update: asyncHandler(async (req, res) => {
    const session = await examinationSessionsService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { examinationSession: session });
  }),

  remove: asyncHandler(async (req, res) => {
    await examinationSessionsService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, { message: 'Examination session deleted.' });
  }),
};
