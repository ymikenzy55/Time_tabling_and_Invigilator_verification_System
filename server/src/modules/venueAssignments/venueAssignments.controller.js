import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { venueAssignmentsService } from './venueAssignments.service.js';

export const venueAssignmentsController = {
  assign: asyncHandler(async (req, res) => {
    const result = await venueAssignmentsService.assignForSession(
      req.body.examinationSessionId,
      { maxPerVenue: req.body.maxPerVenue },
      req.user,
    );
    return ApiResponse.ok(res, result);
  }),

  manualAssign: asyncHandler(async (req, res) => {
    const assignment = await venueAssignmentsService.manualAssign(req.body, req.user);
    return ApiResponse.created(res, assignment);
  }),

  removeAssignment: asyncHandler(async (req, res) => {
    const result = await venueAssignmentsService.removeAssignment(req.params.id, req.user);
    return ApiResponse.ok(res, result);
  }),

  list: asyncHandler(async (req, res) => {
    const assignments = await venueAssignmentsService.list(req.query, req.user);
    return ApiResponse.ok(res, { assignments });
  }),

  myAssignments: asyncHandler(async (req, res) => {
    const assignments = await venueAssignmentsService.myAssignments(req.user);
    return ApiResponse.ok(res, { assignments });
  }),

  invigilatorCount: asyncHandler(async (_req, res) => {
    const count = await venueAssignmentsService.invigilatorCount();
    return ApiResponse.ok(res, { count });
  }),
};
