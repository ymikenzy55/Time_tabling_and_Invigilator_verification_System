import { api } from '@/lib/api';

export const coursesApi = {
  list: (params) => api.get('/courses', { params }).then(({ data }) => data.courses),
  create: (payload) => api.post('/courses', payload).then(({ data }) => data.course),
  bulkImport: (payload) => api.post('/courses/import', payload).then(({ data }) => data),
  update: (id, payload) => api.patch(`/courses/${id}`, payload).then(({ data }) => data.course),
  remove: (id) => api.delete(`/courses/${id}`).then(({ data }) => data),
  submit: (id) => api.post(`/courses/${id}/submit`).then(({ data }) => data.course),
  approve: (id, payload) => api.post(`/courses/${id}/approve`, payload).then(({ data }) => data.course),
  approveAll: (ids) => api.post('/courses/approve-all', { ids }).then(({ data }) => data),
  reject: (id, payload) => api.post(`/courses/${id}/reject`, payload).then(({ data }) => data.course),
};
