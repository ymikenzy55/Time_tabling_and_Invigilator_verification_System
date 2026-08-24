import { notificationsService } from './notifications.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const notificationsController = {
  list: async (req, res) => {
    const { unread, limit } = req.query;
    const rows = await notificationsService.list(req.user.id, {
      unreadOnly: unread === 'true' || unread === '1',
      limit: limit ? Math.min(Math.max(Number(limit) || 0, 1), 200) : undefined,
    });
    res.json(rows);
  },

  unreadCount: async (req, res) => {
    const count = await notificationsService.unreadCount(req.user.id);
    res.json({ count });
  },

  markRead: async (req, res) => {
    await notificationsService.markRead(req.user.id, req.params.id);
    res.json({ ok: true });
  },

  markAllRead: async (req, res) => {
    await notificationsService.markAllRead(req.user.id);
    res.json({ ok: true });
  },

  markByType: async (req, res) => {
    await notificationsService.markByType(req.user.id, req.body.type);
    res.json({ ok: true });
  },

  delegateMessage: asyncHandler(async (req, res) => {
    const { reason, delegateName, delegateEmail, originalInvigilator, originalInvigilatorStaffId } = req.body;
    await notificationsService.sendDelegateMessage({
      reason,
      delegateName,
      delegateEmail,
      originalInvigilator,
      originalInvigilatorStaffId,
      senderId: req.user.id,
    });
    res.json({ ok: true });
  }),
};
