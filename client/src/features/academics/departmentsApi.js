import { api } from '@/lib/api';

export const departmentsApi = {
  list: (params) => api.get('/departments', { params }).then((r) => r.data.departments),
  listNames: () => api.get('/departments/public').then((r) => r.data.departments),
  getMine: () => api.get('/departments/me').then((r) => r.data),
  create: (payload) => api.post('/departments', payload).then((r) => r.data.department),
  update: (id, payload) => api.patch(`/departments/${id}`, payload).then((r) => r.data.department),
  remove: (id) => api.delete(`/departments/${id}`).then((r) => r.data),
};
