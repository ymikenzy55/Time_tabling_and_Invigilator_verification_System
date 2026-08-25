import { Server } from 'socket.io';
import { verifyAccessToken } from './jwt.js';
import { prisma } from './prisma.js';
import { clientOrigins } from '../config/env.js';

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: clientOrigins, credentials: true },
    // Keep long-polling available: platforms that spin down idle services
    // reject the initial WebSocket upgrade while waking up.
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));

    try {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE') return next(new Error('Unauthorized'));

      socket.userId = user.id;
      socket.userRole = user.role;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);
  });

  return io;
};

export const getIO = () => io;
