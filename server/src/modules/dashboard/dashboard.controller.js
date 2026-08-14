import { prisma } from '../../utils/prisma.js';
import { cache } from '../../utils/cache.js';

const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

export const dashboardController = {
  summary: async (req, res) => {
    const { role, id: userId, departmentId } = req.user;
    const now = new Date();
    const cacheKey = `dashboard:${role}:${userId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    if (role === 'SUPER_ADMIN') {
      const [
        totalUsers, pendingApprovals, openWindows,
        coursesSubmitted, coursesApproved, upcomingSessions,
        recentAudits,
      ] = await Promise.all([
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { status: 'PENDING_APPROVAL' } }),
        prisma.registrationWindow.count({ where: { opensAt: { lte: now }, closesAt: { gte: now } } }),
        prisma.course.count({ where: { status: 'SUBMITTED' } }),
        prisma.course.count({ where: { status: 'APPROVED' } }),
        prisma.examinationSession.count({ where: { startDate: { gt: now } } }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true, action: true, createdAt: true, targetType: true, targetId: true,
            actor: { select: { id: true, fullName: true, email: true } },
          },
        }),
      ]);

      const data = {
        stats: [
          { key: 'users',    label: 'Active Users',        value: totalUsers,       link: '/department-heads' },
          { key: 'approvals',label: 'Pending Approvals',   value: pendingApprovals, link: '/approvals' },
          { key: 'windows',  label: 'Open Registration Windows', value: openWindows, link: '/registration-windows' },
          { key: 'submitted',label: 'Courses To Approve',  value: coursesSubmitted, link: '/course-approvals' },
          { key: 'approved', label: 'Approved Courses',    value: coursesApproved,  link: '/courses' },
          { key: 'exams',    label: 'Upcoming Exam Sessions', value: upcomingSessions, link: '/examinations' },
        ],
        recentActivity: recentAudits,
      };
      cache.set(cacheKey, data, 15_000);
      return res.json({ success: true, data });
    }

    if (role === 'DEPARTMENT_HEAD') {
      const baseWhere = { createdById: userId };
      const [drafts, submitted, approved, rejected, recent] = await Promise.all([
        prisma.course.count({ where: { ...baseWhere, status: 'DRAFT' } }),
        prisma.course.count({ where: { ...baseWhere, status: 'SUBMITTED' } }),
        prisma.course.count({ where: { ...baseWhere, status: 'APPROVED' } }),
        prisma.course.count({ where: { ...baseWhere, status: 'REJECTED' } }),
        prisma.course.findMany({
          where: baseWhere,
          orderBy: { updatedAt: 'desc' },
          take: 6,
          select: { id: true, code: true, title: true, status: true, updatedAt: true },
        }),
      ]);

      const data = {
        stats: [
          { key: 'drafts',    label: 'Drafts',          value: drafts,    link: '/courses' },
          { key: 'submitted', label: 'Awaiting Approval', value: submitted, link: '/courses' },
          { key: 'approved',  label: 'Approved Courses', value: approved, link: '/courses' },
          { key: 'rejected',  label: 'Rejected',        value: rejected,  link: '/courses' },
        ],
        recentActivity: recent.map((c) => ({
          id: c.id,
          action: `COURSE.${c.status}`,
          createdAt: c.updatedAt,
          targetType: 'Course',
          targetId: c.id,
          label: `${c.code} — ${c.title}`,
        })),
      };
      cache.set(cacheKey, data, 15_000);
      return res.json({ success: true, data });
    }

    if (role === 'INVIGILATOR') {
      const soon = daysFromNow(7);
      const [total, upcoming, thisWeek, recent] = await Promise.all([
        prisma.invigilation.count({ where: { invigilatorId: userId } }),
        prisma.invigilation.count({ where: { invigilatorId: userId, scheduledAt: { gt: now } } }),
        prisma.invigilation.count({
          where: { invigilatorId: userId, scheduledAt: { gt: now, lte: soon } },
        }),
        prisma.invigilation.findMany({
          where: { invigilatorId: userId },
          orderBy: { scheduledAt: 'desc' },
          take: 6,
          select: {
            id: true, scheduledAt: true,
            course: { select: { code: true, title: true } },
            examinationSession: { select: { name: true } },
          },
        }),
      ]);

      const data = {
        stats: [
          { key: 'total',    label: 'Total Assignments',   value: total,    link: '/my-assignments' },
          { key: 'upcoming', label: 'Upcoming',            value: upcoming, link: '/my-assignments' },
          { key: 'week',     label: 'Within 7 Days',       value: thisWeek, link: '/my-assignments' },
        ],
        recentActivity: recent.map((i) => ({
          id: i.id,
          action: 'INVIGILATION.SCHEDULED',
          createdAt: i.scheduledAt,
          targetType: 'Invigilation',
          targetId: i.id,
          label: `${i.course?.code || ''} — ${i.course?.title || ''} (${i.examinationSession?.name || ''})`,
        })),
      };
      cache.set(cacheKey, data, 15_000);
      return res.json({ success: true, data });
    }

    res.json({ success: true, data: { stats: [], recentActivity: [] } });
  },
};
