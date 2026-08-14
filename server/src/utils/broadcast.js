import { getIO } from './socket.js';

export const broadcast = {
  toRoles(roles, event, data) {
    const io = getIO();
    if (!io) return;
    const arr = Array.isArray(roles) ? roles : [roles];
    for (const role of arr) {
      io.to(`role:${role}`).emit(event, data);
    }
  },

  toUser(userId, event, data) {
    const io = getIO();
    if (!io) return;
    io.to(`user:${userId}`).emit(event, data);
  },
};
