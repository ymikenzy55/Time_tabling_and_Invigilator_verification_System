import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { attendanceService } from './attendance.service.js';

export const attendanceController = {
  generateQr: asyncHandler(async (req, res) => {
    const data = await attendanceService.generateQr(req.params.invigilationId, req.user);
    return ApiResponse.ok(res, data);
  }),

  generateVenueQr: asyncHandler(async (req, res) => {
    const { venueId, examinationSessionId } = req.params;
    const data = await attendanceService.generateVenueQr(venueId, examinationSessionId, req.user);
    return ApiResponse.ok(res, data);
  }),

  generateVenueQrBatch: asyncHandler(async (req, res) => {
    const { examinationSessionId } = req.params;
    const data = await attendanceService.generateVenueQrBatch(examinationSessionId, req.user);
    return ApiResponse.ok(res, data);
  }),

  scan: asyncHandler(async (req, res) => {
    const result = await attendanceService.scan({
      token: req.body.token,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    }, req.user);
    return ApiResponse.ok(res, result);
  }),

  previewVenueScan: asyncHandler(async (req, res) => {
    const result = await attendanceService.previewVenueScan({ token: req.body.token }, req.user);
    return ApiResponse.ok(res, result);
  }),

  scanVenue: asyncHandler(async (req, res) => {
    const result = await attendanceService.scanVenue({
      token: req.body.token,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers['user-agent'] || null,
    }, req.user);
    return ApiResponse.ok(res, result);
  }),

  list: asyncHandler(async (req, res) => {
    const records = await attendanceService.list(req.query, req.user);
    return ApiResponse.ok(res, { records });
  }),

  listVenueScans: asyncHandler(async (req, res) => {
    const records = await attendanceService.listVenueScans(req.query, req.user);
    return ApiResponse.ok(res, { records });
  }),
};
