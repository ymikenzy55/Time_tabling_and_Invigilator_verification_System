import { api } from '@/lib/api';

export const facultiesApi = {
  list: (params) => api.get('/faculties', { params }).then((r) => r.data.faculties),
  create: (payload) => api.post('/faculties', payload).then((r) => r.data.faculty),
  update: (id, payload) => api.patch(`/faculties/${id}`, payload).then((r) => r.data.faculty),
  remove: (id) => api.delete(`/faculties/${id}`).then((r) => r.data),
};
