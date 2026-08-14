import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { passwordResetService } from './passwordReset.service.js';

export const passwordResetController = {
  requestReset: asyncHandler(async (req, res) => {
    const result = await passwordResetService.requestReset(req.body);
    return ApiResponse.ok(res, result);
  }),

  confirmReset: asyncHandler(async (req, res) => {
    const result = await passwordResetService.confirmReset(req.body);
    return ApiResponse.ok(res, result);
  }),
};
