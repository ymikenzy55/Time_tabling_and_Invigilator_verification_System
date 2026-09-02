import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'ems.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// Lightweight pub/sub so AuthContext can react to 401s without importing axios.
const authListeners = new Set();
export const onAuthError = (fn) => {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
};

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data, // unwrap { success, data, ... }
  (error) => {
    const payload = error?.response?.data;
    const status = error?.response?.status;
    if (status === 401) {
      // Session expired / invalid — clear token and notify auth context.
      tokenStore.clear();
      authListeners.forEach((fn) => fn());
    }

    let message;
    if (status) {
      // Server responded with an error status — use the server's message.
      message =
        payload?.error?.message ||
        'Request failed. Please try again.';
    } else if (error?.code === 'ECONNABORTED' || error?.name === 'TimeoutError') {
      message = 'The request timed out. Please check your connection and try again.';
    } else if (error?.code === 'ERR_NETWORK' || !error?.response) {
      message = 'Network error — unable to reach the server. Please check your internet connection and try again.';
    } else {
      message = error?.message || 'Something went wrong. Please try again.';
    }

    return Promise.reject({
      status,
      code: payload?.error?.code || 'UNKNOWN',
      message,
      details: payload?.error?.details,
    });
  }
);
