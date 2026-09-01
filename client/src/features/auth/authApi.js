import { api } from '@/lib/api';

export const authApi = {
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }).then(({ data }) => data),
  resetPassword: (payload) =>
    api.post('/auth/reset-password', payload).then(({ data }) => data),
  sendVerificationCode: (email) =>
    api.post('/auth/send-verification-code', { email }).then(({ data }) => data),
  verifyEmail: (email, code) =>
    api.post('/auth/verify-email', { email, code }).then(({ data }) => data),
  resendVerificationCode: (email) =>
    api.post('/auth/resend-verification-code', { email }).then(({ data }) => data),
};
