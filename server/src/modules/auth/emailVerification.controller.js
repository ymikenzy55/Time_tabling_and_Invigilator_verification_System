import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { emailVerificationService } from './emailVerification.service.js';

export const emailVerificationController = {
  sendCode: asyncHandler(async (req, res) => {
    const result = await emailVerificationService.sendVerificationCode(req.body.email);
    return ApiResponse.ok(res, result);
  }),

  verifyCode: asyncHandler(async (req, res) => {
    const result = await emailVerificationService.verifyCode(req.body.email, req.body.code);
    return ApiResponse.ok(res, result);
  }),

  resendCode: asyncHandler(async (req, res) => {
    const result = await emailVerificationService.resendCode(req.body.email);
    return ApiResponse.ok(res, result);
  }),
};
