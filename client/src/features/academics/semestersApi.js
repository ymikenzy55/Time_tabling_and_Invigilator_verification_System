import { api } from '@/lib/api';

export const semestersApi = {
  list: (params) => api.get('/semesters', { params }).then((r) => r.data.semesters),
  create: (payload) => api.post('/semesters', payload).then((r) => r.data.semester),
  update: (id, payload) => api.patch(`/semesters/${id}`, payload).then((r) => r.data.semester),
  remove: (id) => api.delete(`/semesters/${id}`).then((r) => r.data),
};
