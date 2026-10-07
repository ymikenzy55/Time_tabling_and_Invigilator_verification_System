import { io } from 'socket.io-client';
import { API_BASE_URL, tokenStore } from './api';

// Socket.IO lives at the API origin, without the /api/v1 prefix.
const BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

let socket = null;

export const getSocket = () => {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }

  const token = tokenStore.get();
  if (!token) return null;

  // Allow HTTP long-polling as a fallback: hosts that spin down idle services
  // (e.g. Render's free plan) reject the initial WebSocket upgrade while waking,
  // so polling keeps realtime working and upgrades to WebSocket once available.
  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 60000,
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
