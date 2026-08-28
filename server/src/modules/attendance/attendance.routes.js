import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { attendanceController } from './attendance.controller.js';
import { attendanceSchemas } from './attendance.validators.js';

const router = Router();

router.use(requireAuth);

router.get('/qr/:invigilationId', attendanceController.generateQr);
router.get('/venue-qr-batch/:examinationSessionId', requireRole('SUPER_ADMIN'), attendanceController.generateVenueQrBatch);
router.get('/venue-qr/:venueId/:examinationSessionId', requireRole('SUPER_ADMIN'), attendanceController.generateVenueQr);
router.post('/scan', validate(attendanceSchemas.scan), attendanceController.scan);
router.post('/scan-venue/preview', validate(attendanceSchemas.scan), attendanceController.previewVenueScan);
router.post('/scan-venue', validate(attendanceSchemas.scan), attendanceController.scanVenue);
router.get('/', attendanceController.list);
router.get('/venue-scans', attendanceController.listVenueScans);

export default router;
