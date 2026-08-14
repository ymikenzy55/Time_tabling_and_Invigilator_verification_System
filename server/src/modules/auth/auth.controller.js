import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { authService } from './auth.service.js';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const result = await authService.login({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
    return ApiResponse.ok(res, result);
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.me(req.user.id);
    return ApiResponse.ok(res, { user });
  }),

  logout: asyncHandler(async (_req, res) => {
    // Stateless JWT — client discards token. Kept for future refresh-token support.
    return ApiResponse.ok(res, { message: 'Signed out.' });
  }),
};
