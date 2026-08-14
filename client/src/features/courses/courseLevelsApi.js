import { api } from '@/lib/api';

export const courseLevelsApi = {
  list: (params) => api.get('/course-levels', { params }).then((r) => r.data),
  create: (payload) => api.post('/course-levels', payload).then((r) => r.data.level),
  remove: (id, params) => api.delete(`/course-levels/${id}`, { params }).then((r) => r.data),
};
