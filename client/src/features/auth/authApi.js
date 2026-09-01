import { api } from '@/lib/api';

export const authApi = {
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }).then(({ data }) => data),
  resetPassword: (payload) =>
    api.post('/auth/reset-password', payload).then(({ data }) => data),
};
