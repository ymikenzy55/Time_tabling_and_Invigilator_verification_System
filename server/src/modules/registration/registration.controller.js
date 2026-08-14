import { asyncHandler } from '../../utils/asyncHandler.js';
import { registrationService } from './registration.service.js';

export const registrationController = {
  status: asyncHandler(async (_req, res) => {
    const data = await registrationService.status();
    res.json({ success: true, data });
  }),

  checkStaffId: asyncHandler(async (req, res) => {
    const data = await registrationService.checkStaffId(req.query.staffId);
    res.json({ success: true, data });
  }),

  register: asyncHandler(async (req, res) => {
    const user = await registrationService.register(req.body);
    res.status(201).json({ success: true, data: { user } });
  }),

  listWindows: asyncHandler(async (_req, res) => {
    const windows = await registrationService.listWindows();
    res.json({ success: true, data: { windows } });
  }),

  setWindow: asyncHandler(async (req, res) => {
    const window = await registrationService.setWindow(req.params.role, req.body, req.user);
    res.json({ success: true, data: { window } });
  }),

  closeWindow: asyncHandler(async (req, res) => {
    const data = await registrationService.closeWindow(req.params.role, req.user);
    res.json({ success: true, data });
  }),
};
