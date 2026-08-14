import { api } from '@/lib/api';

export const invigilationsApi = {
  list: (params) => api.get('/invigilations', { params }).then((r) => r.data.invigilations),
  myAssignments: () => api.get('/invigilations/my').then((r) => r.data.invigilations),
  create: (payload) => api.post('/invigilations', payload).then((r) => r.data.invigilation),
  update: (id, payload) => api.patch(`/invigilations/${id}`, payload).then((r) => r.data.invigilation),
  replace: (id, payload) => api.post(`/invigilations/${id}/replace`, payload).then((r) => r.data.invigilation),
  remove: (id) => api.delete(`/invigilations/${id}`).then((r) => r.data),
};
