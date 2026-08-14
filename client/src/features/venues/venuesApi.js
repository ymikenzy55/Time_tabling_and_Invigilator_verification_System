import { api } from '@/lib/api';

export const venuesApi = {
  list: (params) => api.get('/venues', { params }).then(({ data }) => data.venues),
  create: (payload) => api.post('/venues', payload).then(({ data }) => data.venue),
  bulkImport: (venues) => api.post('/venues/import', { venues }).then(({ data }) => data),
  update: (id, payload) => api.patch(`/venues/${id}`, payload).then(({ data }) => data.venue),
  remove: (id) => api.delete(`/venues/${id}`).then(({ data }) => data),
};
