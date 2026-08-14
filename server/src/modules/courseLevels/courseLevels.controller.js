import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { courseLevelsService } from './courseLevels.service.js';

export const courseLevelsController = {
  list: asyncHandler(async (req, res) => {
    const levels = await courseLevelsService.list(req.user, req.query);
    const meta = req.user.role === 'DEPARTMENT_HEAD' && !req.user.departmentId
      ? {
          placeholder: true,
          note: 'Default levels shown because your account is not yet assigned to a department.',
          requestedName: req.user.departmentName || null,
        }
      : undefined;
    return ApiResponse.ok(res, { levels, meta });
  }),

  create: asyncHandler(async (req, res) => {
    const level = await courseLevelsService.create(req.user, req.body);
    return ApiResponse.created(res, { level });
  }),

  remove: asyncHandler(async (req, res) => {
    await courseLevelsService.remove(req.user, req.params.id);
    return ApiResponse.ok(res, { id: req.params.id });
  }),
};
