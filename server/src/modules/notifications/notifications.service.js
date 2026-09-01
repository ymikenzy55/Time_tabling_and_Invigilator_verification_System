import { prisma } from '../../utils/prisma.js';
import { broadcast } from '../../utils/broadcast.js';
import { sendSMS, formatGhanaPhone } from '../../utils/sms.js';

/**
 * Create a notification for a single user, silently ignoring failures so notification
 * emission never breaks the main request.
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.link - Optional link
 * @param {Object} params.data - Optional additional data
 * @param {boolean} params.sendSms - Whether to send SMS (default: false)
 * @param {boolean} params.sendEmail - Whether to send email (default: false)
 */
export const createNotification = async ({ 
  userId, 
  type, 
  title, 
  message, 
  link, 
  data,
  sendSms = false,
  sendEmail = false 
}) => {
  if (!userId) return null;
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, link, data },
    });
    broadcast.toUser(userId, 'notification.created', { notification });

    // Send SMS if requested and user has phone number
    if (sendSms) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { phoneNumber: true, name: true },
        });

        if (user?.phoneNumber) {
          const formattedPhone = formatGhanaPhone(user.phoneNumber);
          if (formattedPhone) {
            const smsText = `${title}\n\n${message}`;
            await sendSMS({ to: formattedPhone, message: smsText });
          } else {
            console.warn('[notification] Invalid phone number format for user:', userId);
          }
        } else {
          console.warn('[notification] No phone number for user:', userId);
        }
      } catch (smsError) {
        console.error('[notification] SMS send failed:', smsError.message);
        // Don't throw - SMS failure shouldn't break notification
      }
    }

    // TODO: Add email sending here if needed
    // if (sendEmail) { ... }

    return notification;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to create notification:', err.message);
    return null;
  }
};

/** Notify all users with a given role. Creates notifications individually so
 * each broadcast includes a complete object (id, createdAt, isRead). 
 * 
 * @param {string} role - User role to notify
 * @param {Object} params - Notification parameters
 * @param {boolean} params.sendSms - Whether to send SMS (default: false)
 * @param {boolean} params.sendEmail - Whether to send email (default: false)
 */
export const notifyRole = async (role, { type, title, message, link, data, sendSms = false, sendEmail = false }) => {
  try {
    const users = await prisma.user.findMany({
      where: { role, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!users.length) return;

    await Promise.all(
      users.map((u) =>
        createNotification({ 
          userId: u.id, 
          type, 
          title, 
          message, 
          link, 
          data,
          sendSms,
          sendEmail 
        })
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

  async sendDelegateMessage({ reason, delegateName, delegateEmail, originalInvigilator, originalInvigilatorStaffId, senderId }) {
    const message = `${originalInvigilator} (Staff ID: ${originalInvigilatorStaffId || 'N/A'}) has created a delegate invigilator: ${delegateName} (${delegateEmail}). Reason: ${reason}`;
    return notifyRole('SUPER_ADMIN', {
      type: 'DELEGATE_INVIGILATOR',
      title: 'Delegate Invigilator Created',
      message,
      link: '/invigilator-assignments',
      data: { reason, delegateName, delegateEmail, originalInvigilator, senderId },
      sendSms: true, // Enable SMS for important admin notifications
      sendEmail: false,
    });
  },
};
