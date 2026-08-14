import { api } from '@/lib/api';

export const timetableApi = {
  initialData: () => api.get('/timetable/initial').then((r) => r.data),
  generate: (payload) => api.post('/timetable/generate', payload).then((r) => r.data),
  readiness: (examinationSessionId) => api.get(`/timetable/readiness/${examinationSessionId}`).then((r) => r.data),
  list: (params) => api.get('/timetable', { params }).then((r) => r.data.entries),
  updateEntry: (entryId, payload) => api.patch(`/timetable/entries/${entryId}`, payload).then((r) => r.data),
  deleteEntry: (entryId) => api.delete(`/timetable/entries/${entryId}`).then((r) => r.data),
  deleteTimetable: (examinationSessionId) => api.delete(`/timetable/${examinationSessionId}`).then((r) => r.data),
};
