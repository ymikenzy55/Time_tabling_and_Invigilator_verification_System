import { api } from '@/lib/api';

export const examinationSessionsApi = {
  list: (params) => api.get('/examination-sessions', { params }).then((r) => r.data.examinationSessions),
  create: (payload) => api.post('/examination-sessions', payload).then((r) => r.data.examinationSession),
  update: (id, payload) => api.patch(`/examination-sessions/${id}`, payload).then((r) => r.data.examinationSession),
  remove: (id) => api.delete(`/examination-sessions/${id}`).then((r) => r.data),
};
