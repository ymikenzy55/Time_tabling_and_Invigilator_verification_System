import { api } from '@/lib/api';

export const attendanceApi = {
  generateQr: (invigilationId) => api.get(`/attendance/qr/${invigilationId}`).then((r) => r.data),
  generateVenueQr: (venueId, examinationSessionId) => api.get(`/attendance/venue-qr/${venueId}/${examinationSessionId}`).then((r) => r.data),
  generateVenueQrBatch: (examinationSessionId) => api.get(`/attendance/venue-qr-batch/${examinationSessionId}`).then((r) => r.data),
  scan: (token) => api.post('/attendance/scan', { token }).then((r) => r.data),
  previewVenueScan: (token) => api.post('/attendance/scan-venue/preview', { token }).then((r) => r.data),
  scanVenue: (token) => api.post('/attendance/scan-venue', { token }).then((r) => r.data),
  list: (params) => api.get('/attendance', { params }).then((r) => r.data.records),
  listVenueScans: (params) => api.get('/attendance/venue-scans', { params }).then((r) => r.data.records),
};
