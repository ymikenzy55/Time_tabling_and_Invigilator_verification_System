import { api } from '@/lib/api';

export const usersApi = {
  list: (params) => api.get('/users', { params }).then((r) => r.data.users),
  create: (payload) => api.post('/users', payload).then((r) => r.data.user),
  update: (id, payload) => api.patch(`/users/${id}`, payload).then((r) => r.data.user),
  remove: (id) => api.delete(`/users/${id}`),
  changeMyPassword: (payload) => api.post('/users/me/change-password', payload),
  listPendingApprovals: () => api.get('/users/approvals/pending').then((r) => r.data.users),
  approveUser: (id) => api.post(`/users/approvals/${id}/approve`).then((r) => r.data.user),
  rejectUser: (id, payload) => api.post(`/users/approvals/${id}/reject`, payload).then((r) => r.data.user),
  setStatus: (id, payload) => api.patch(`/users/${id}/status`, payload).then((r) => r.data.user),
  listPeerDepartmentHeads: () => api.get('/users/department-heads/peers').then((r) => r.data.users),
  createPeerDepartmentHead: (payload) => api.post('/users/department-heads', payload).then((r) => r.data.user),
  createDelegate: (payload) => api.post('/users/delegate', payload).then((r) => r.data.user),
};
