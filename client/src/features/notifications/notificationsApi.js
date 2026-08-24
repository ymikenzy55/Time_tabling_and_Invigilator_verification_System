import { api } from '@/lib/api';

export const notificationsApi = {
  list: (params) => api.get('/notifications', { params }).then((r) => (Array.isArray(r) ? r : [])),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r?.count ?? 0),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  markReadByType: (type) => api.post('/notifications/read-by-type', { type }),
  sendDelegateMessage: (payload) => api.post('/notifications/delegate-message', payload),
};
