import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { usersService } from './users.service.js';

export const usersController = {
  list: asyncHandler(async (req, res) => {
    const users = await usersService.list(req.query);
    return ApiResponse.ok(res, { users });
  }),

  getOne: asyncHandler(async (req, res) => {
    const user = await usersService.getById(req.params.id);
    return ApiResponse.ok(res, { user });
  }),

  create: asyncHandler(async (req, res) => {
    const user = await usersService.create(req.body, req.user);
    return ApiResponse.created(res, { user });
  }),

  update: asyncHandler(async (req, res) => {
    const user = await usersService.update(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { user });
  }),

  remove: asyncHandler(async (req, res) => {
    await usersService.remove(req.params.id, req.user);
    return ApiResponse.ok(res, { id: req.params.id });
  }),

  changeMyPassword: asyncHandler(async (req, res) => {
    const result = await usersService.changePassword(req.user.id, req.body);
    return ApiResponse.ok(res, result);
  }),

  listPeerDepartmentHeads: asyncHandler(async (req, res) => {
    const users = await usersService.listPeerDepartmentHeads(req.user);
    return ApiResponse.ok(res, { users });
  }),

  createPeerDepartmentHead: asyncHandler(async (req, res) => {
    const user = await usersService.createPeerDepartmentHead(req.body, req.user);
    return ApiResponse.created(res, { user });
  }),

  listPendingApprovals: asyncHandler(async (req, res) => {
    const users = await usersService.listPendingApprovals();
    return ApiResponse.ok(res, { users });
  }),

  approveUser: asyncHandler(async (req, res) => {
    const user = await usersService.approveUser(req.params.id, req.user);
    return ApiResponse.ok(res, { user });
  }),

  rejectUser: asyncHandler(async (req, res) => {
    const user = await usersService.rejectUser(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { user });
  }),

  setStatus: asyncHandler(async (req, res) => {
    const user = await usersService.setStatus(req.params.id, req.body, req.user);
    return ApiResponse.ok(res, { user });
  }),
};
