import { api } from '@/lib/api';

export const academicYearsApi = {
  list: (params) => api.get('/academic-years', { params }).then((r) => r.data.academicYears),
  create: (payload) => api.post('/academic-years', payload).then((r) => r.data.academicYear),
  update: (id, payload) => api.patch(`/academic-years/${id}`, payload).then((r) => r.data.academicYear),
  remove: (id) => api.delete(`/academic-years/${id}`).then((r) => r.data),
};
