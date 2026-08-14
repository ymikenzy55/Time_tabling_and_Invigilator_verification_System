import { api } from '@/lib/api';

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary').then((r) => r.data),
};
