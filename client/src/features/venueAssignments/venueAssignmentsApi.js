import { api } from '@/lib/api';

export const venueAssignmentsApi = {
  assign: (examinationSessionId, maxPerVenue) =>
    api.post('/venue-assignments/assign', { examinationSessionId, maxPerVenue }).then((r) => r.data),
  manualAssign: (payload) =>
    api.post('/venue-assignments/manual-assign', payload).then((r) => r.data),
  removeAssignment: (id) =>
    api.delete(`/venue-assignments/${id}`).then((r) => r.data),
  list: (params) => api.get('/venue-assignments', { params }).then((r) => r.data.assignments),
  myAssignments: () => api.get('/venue-assignments/my').then((r) => r.data.assignments),
  invigilatorCount: () => api.get('/venue-assignments/invigilator-count').then((r) => r.data.count),
};
