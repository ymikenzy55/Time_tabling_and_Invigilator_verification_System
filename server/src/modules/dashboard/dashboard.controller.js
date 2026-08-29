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
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [
        totalVenues, totalInvigilators, coursesSubmitted,
        upcomingSessions, todaySessions, activeSessions,
        recentAudits,
      ] = await Promise.all([
        prisma.venue.count(),
        prisma.user.count({ where: { role: 'INVIGILATOR', status: 'ACTIVE' } }),
        prisma.course.count({ where: { status: 'SUBMITTED' } }),
        prisma.examinationSession.count({ where: { startDate: { gt: now } } }),
        prisma.venueAssignment.count({
          where: {
            slotAt: { gte: todayStart, lte: todayEnd },
          },
        }),
        prisma.examinationSession.count({
          where: {
            startDate: { lte: now },
            endDate: { gte: now },
          },
        }),
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
          { key: 'venues',    label: 'Total Venues',        value: totalVenues,       link: '/examinations' },
          { key: 'invigilators', label: 'Invigilators',     value: totalInvigilators, link: '/invigilators' },
          { key: 'submitted',label: 'Courses To Approve',  value: coursesSubmitted, link: '/course-approvals' },
          { key: 'upcoming', label: 'Upcoming Sessions',   value: upcomingSessions, link: '/examinations' },
          { key: 'today',    label: "Today's Exams",       value: todaySessions,     link: '/timetable' },
          { key: 'active',   label: 'Active Sessions',     value: activeSessions,    link: '/examinations' },
        ],
        recentActivity: recentAudits,
      };
      cache.set(cacheKey, data, 15_000);
      return res.json({ success: true, data });
    }

    if (role === 'DEPARTMENT_HEAD') {
      const baseWhere = { createdById: userId };
      const deptId = departmentId || null;

      const [drafts, submitted, approved, rejected, recent, deptHeadCount, deptCourseCount, deptCourseLevelCount, department] = await Promise.all([
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
        deptId ? prisma.user.count({ where: { role: 'DEPARTMENT_HEAD', departmentId: deptId } }) : Promise.resolve(0),
        deptId ? prisma.course.count({ where: { departmentId: deptId } }) : Promise.resolve(0),
        deptId ? prisma.courseLevel.count({ where: { departmentId: deptId } }) : Promise.resolve(0),
        deptId ? prisma.department.findUnique({ where: { id: deptId }, select: { id: true, name: true, code: true, faculty: { select: { name: true } } } }) : Promise.resolve(null),
      ]);

      const data = {
        stats: [
          { key: 'drafts',    label: 'Drafts',          value: drafts,    link: '/courses' },
          { key: 'submitted', label: 'Awaiting Approval', value: submitted, link: '/courses' },
          { key: 'approved',  label: 'Approved Courses', value: approved, link: '/courses' },
          { key: 'rejected',  label: 'Rejected',        value: rejected,  link: '/courses' },
        ],
        department: department ? {
          name: department.name,
          code: department.code,
          faculty: department.faculty?.name || null,
          headCount: deptHeadCount,
          courseCount: deptCourseCount,
          courseLevelCount: deptCourseLevelCount,
        } : null,
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
        prisma.venueAssignment.count({ where: { invigilatorId: userId } }),
        prisma.venueAssignment.count({ where: { invigilatorId: userId, slotAt: { gt: now } } }),
        prisma.venueAssignment.count({
          where: { invigilatorId: userId, slotAt: { gt: now, lte: soon } },
        }),
        prisma.venueAssignment.findMany({
          where: { invigilatorId: userId },
          orderBy: { slotAt: 'desc' },
          take: 6,
          select: {
            id: true, slotAt: true,
            venue: { select: { name: true, location: true } },
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
        recentActivity: recent.map((a) => ({
          id: a.id,
          action: 'INVIGILATION.SCHEDULED',
          createdAt: a.slotAt,
          targetType: 'VenueAssignment',
          targetId: a.id,
          label: `${a.venue?.name || ''} — ${a.examinationSession?.name || ''}`,
        })),
      };
      cache.set(cacheKey, data, 15_000);
      return res.json({ success: true, data });
    }

    res.json({ success: true, data: { stats: [], recentActivity: [] } });
  },
};
