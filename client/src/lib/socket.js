import { io } from 'socket.io-client';
import { tokenStore } from './api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace('/api/v1', '');

let socket = null;

export const getSocket = () => {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }

  const token = tokenStore.get();
  if (!token) return null;

  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket'],
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
