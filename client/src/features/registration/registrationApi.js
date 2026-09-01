import { api } from '@/lib/api';

export const registrationApi = {
  status: () => api.get('/registration/status').then((r) => r.data),
  checkStaffId: (staffId) => api.get('/registration/check-staff-id', { params: { staffId } }).then((r) => r.data),
  checkEmail: (email) => api.get('/registration/check-email', { params: { email } }).then((r) => r.data),
  register: (payload) => api.post('/registration', payload).then((r) => r.data.user),
  listWindows: () => api.get('/registration/windows').then((r) => r.data.windows),
  setWindow: (role, payload) =>
    api.put(`/registration/windows/${role}`, payload).then((r) => r.data.window),
  closeWindow: (role) => api.delete(`/registration/windows/${role}`),
};
