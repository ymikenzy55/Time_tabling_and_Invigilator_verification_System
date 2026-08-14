import { prisma } from '../../utils/prisma.js';
import { broadcast } from '../../utils/broadcast.js';

/**
 * Create a notification for a single user, silently ignoring failures so notification
 * emission never breaks the main request.
 */
export const createNotification = async ({ userId, type, title, message, link, data }) => {
  if (!userId) return null;
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link, data },
    });
    broadcast.toUser(userId, 'notification.created', { notification });
    return notification;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to create notification:', err.message);
    return null;
  }
};

/** Notify all users with a given role. Creates notifications individually so
 * each broadcast includes a complete object (id, createdAt, isRead). */
export const notifyRole = async (role, { type, title, message, link, data }) => {
  try {
    const users = await prisma.user.findMany({
      where: { role, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!users.length) return;

    await Promise.all(
      users.map((u) =>
        createNotification({ userId: u.id, type, title, message, link, data })
      )
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to notify role:', err.message);
  }
};

export const notificationsService = {
  async list(userId, { unreadOnly = false, limit = 50 } = {}) {
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async unreadCount(userId) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  async markRead(userId, id) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  async markByType(userId, type) {
    return prisma.notification.updateMany({
      where: { userId, type, isRead: false },
      data: { isRead: true },
    });
  },
};
