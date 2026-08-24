import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';
import { createNotification } from '../notifications/notifications.service.js';

const publicSelect = {
  id: true,
  slotAt: true,
  createdAt: true,
  venue: { select: { id: true, name: true, capacity: true, location: true } },
  invigilator: { select: { id: true, fullName: true, email: true, staffId: true } },
  examinationSession: { select: { id: true, name: true } },
};

const DEFAULT_MAX_PER_VENUE = 4;

const invigilatorsNeeded = (studentCount, maxPerVenue = DEFAULT_MAX_PER_VENUE) => {
  if (!studentCount || studentCount <= 0) return 1;
  return Math.min(maxPerVenue, Math.max(1, Math.ceil(studentCount / 50)));
};

const getTimeSlotHour = (date) => {
  const h = new Date(date).getHours();
  if (h < 11) return 8;
  if (h < 14) return 11;
  return 14;
};

const isSameTimeSlot = (a, b) => {
  return getTimeSlotHour(a) === getTimeSlotHour(b) &&
    new Date(a).toDateString() === new Date(b).toDateString();
};

export const venueAssignmentsService = {
  async assignForSession(examinationSessionId, { maxPerVenue } = {}, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only exam officers can assign invigilators.');
    }

    const session = await prisma.examinationSession.findUnique({
      where: { id: examinationSessionId },
    });
    if (!session) throw ApiError.notFound('Examination session not found.');

    const invigilators = await prisma.user.findMany({
      where: { role: 'INVIGILATOR', status: 'ACTIVE' },
      select: { id: true, fullName: true, email: true, staffId: true, departmentId: true },
      orderBy: { fullName: 'asc' },
    });

    if (invigilators.length === 0) {
      throw ApiError.badRequest('No active invigilators registered. Invite invigilators to register first.');
    }

    const entries = await prisma.invigilation.findMany({
      where: { examinationSessionId },
      include: {
        course: { select: { id: true, code: true, title: true, studentCount: true, departmentId: true } },
        venue: { select: { id: true, name: true, capacity: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (entries.length === 0) {
      throw ApiError.badRequest('No timetable entries found. Generate a timetable first.');
    }

    await prisma.venueAssignment.deleteMany({
      where: { examinationSessionId },
    });

    const limit = Math.max(1, Math.min(10, maxPerVenue || DEFAULT_MAX_PER_VENUE));
    const assignmentRows = [];
    // Track per-invigilator assignments to enforce constraints
    const invigilatorSlots = new Map(); // invigilatorId -> [{ slotAt, venueId }]

    // Group entries by venue+slot so we can assign multiple invigilators per venue per slot
    const venueSlotGroups = new Map();
    for (const entry of entries) {
      if (!entry.venueId) continue;
      const key = `${entry.venueId}_${entry.scheduledAt.getTime()}`;
      if (!venueSlotGroups.has(key)) {
        venueSlotGroups.set(key, { venueId: entry.venueId, slotAt: entry.scheduledAt, students: 0, deptIds: new Set() });
      }
      const group = venueSlotGroups.get(key);
      group.students += entry.course?.studentCount || 0;
      if (entry.course?.departmentId) group.deptIds.add(entry.course.departmentId);
    }

    let invigilatorCursor = 0;
    for (const [, group] of venueSlotGroups) {
      const count = invigilatorsNeeded(group.students, limit);

      for (let i = 0; i < count; i++) {
        // Find an invigilator who doesn't have a conflict at this time slot
        // and is not from the same department as the courses being examined
        let attempts = 0;
        let invigilator = null;

        while (attempts < invigilators.length) {
          const candidate = invigilators[invigilatorCursor % invigilators.length];
          invigilatorCursor++;
          attempts++;

          const existingSlots = invigilatorSlots.get(candidate.id) || [];
          const hasConflict = existingSlots.some((s) =>
            isSameTimeSlot(s.slotAt, group.slotAt)
          );
          const sameDepartment = candidate.departmentId && group.deptIds.has(candidate.departmentId);

          if (!hasConflict && !sameDepartment) {
            invigilator = candidate;
            break;
          }
        }

        // If no invigilator found without conflict, skip this slot
        // (do NOT assign with a conflict — better to leave unassigned than double-book)
        if (!invigilator) {
          console.warn(`No invigilator available for venue ${group.venueId} at ${group.slotAt} without conflict. Skipping.`);
          continue;
        }

        const slots = invigilatorSlots.get(invigilator.id) || [];
        slots.push({ slotAt: group.slotAt, venueId: group.venueId });
        invigilatorSlots.set(invigilator.id, slots);

        assignmentRows.push({
          examinationSessionId,
          venueId: group.venueId,
          invigilatorId: invigilator.id,
          slotAt: group.slotAt,
        });
      }
    }

    if (assignmentRows.length > 0) {
      await prisma.venueAssignment.createMany({
        data: assignmentRows,
        skipDuplicates: true,
      });
    }

    const notified = new Set();
    for (const row of assignmentRows) {
      if (notified.has(row.invigilatorId)) continue;
      notified.add(row.invigilatorId);

      await createNotification({
        userId: row.invigilatorId,
        type: 'INVIGILATION_ASSIGNED',
        title: 'Examination Invigilation Duty',
        message: 'You have been assigned invigilation duties for upcoming examinations. Review your duty schedule for venue and time details.',
        link: '/my-assignments',
        data: { examinationSessionId },
      }).catch(() => {});
    }

    logAudit({
      actorId: actor.id,
      action: 'VENUE_ASSIGNMENT.GENERATE',
      targetType: 'ExaminationSession',
      targetId: examinationSessionId,
      result: 'SUCCESS',
      metadata: { assignments: assignmentRows.length, invigilators: invigilators.length, maxPerVenue: limit },
    });

    return {
      assigned: assignmentRows.length,
      invigilators: invigilators.length,
      slots: new Set(assignmentRows.map((r) => r.slotAt.getTime())).size,
      maxPerVenue: limit,
    };
  },

  async manualAssign({ examinationSessionId, venueId, invigilatorId, slotAt }, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only exam officers can assign invigilators.');
    }

    // Constraint: invigilator must not be from the same department as the courses being examined
    const invigilator = await prisma.user.findUnique({
      where: { id: invigilatorId },
      select: { id: true, departmentId: true, role: true },
    });
    if (!invigilator || invigilator.role !== 'INVIGILATOR') {
      throw ApiError.badRequest('Assigned user must be an invigilator.');
    }

    if (invigilator.departmentId) {
      const sameDeptEntries = await prisma.invigilation.findFirst({
        where: {
          examinationSessionId,
          venueId,
          scheduledAt: new Date(slotAt),
          course: { departmentId: invigilator.departmentId },
        },
      });
      if (sameDeptEntries) {
        throw ApiError.badRequest(
          'This invigilator belongs to the same department as the course being examined. Assign an invigilator from a different department.'
        );
      }
    }

    // Check: invigilator must not be assigned to a different venue at the same time slot
    const conflicting = await prisma.venueAssignment.findFirst({
      where: {
        invigilatorId,
        slotAt: new Date(slotAt),
        examinationSessionId,
        venueId: { not: venueId },
      },
    });
    if (conflicting) {
      throw ApiError.badRequest(
        'This invigilator is already assigned to another venue at this time slot.'
      );
    }

    // Check: invigilator can only have one time frame per day
    const slotDate = new Date(slotAt);
    const dayStart = new Date(slotDate.getFullYear(), slotDate.getMonth(), slotDate.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const sameDayAssignments = await prisma.venueAssignment.findMany({
      where: {
        invigilatorId,
        examinationSessionId,
        slotAt: { gte: dayStart, lt: dayEnd },
      },
    });
    if (sameDayAssignments.length > 0) {
      const existingSlot = sameDayAssignments[0];
      if (!isSameTimeSlot(existingSlot.slotAt, slotAt)) {
        throw ApiError.badRequest(
          'An invigilator can only be assigned one time frame per day. ' +
          `This invigilator already has a slot at ${getTimeSlotHour(existingSlot.slotAt)}:00 on the same day.`
        );
      }
    }

    // Check: venue max invigilators for this slot
    const existingAtSlot = await prisma.venueAssignment.count({
      where: { examinationSessionId, venueId, slotAt: new Date(slotAt) },
    });
    if (existingAtSlot >= DEFAULT_MAX_PER_VENUE) {
      throw ApiError.badRequest(
        `This venue already has ${existingAtSlot} invigilators assigned (max ${DEFAULT_MAX_PER_VENUE}).`
      );
    }

    // Check for duplicate
    const existing = await prisma.venueAssignment.findFirst({
      where: { examinationSessionId, venueId, invigilatorId, slotAt: new Date(slotAt) },
    });
    if (existing) {
      throw ApiError.badRequest('This invigilator is already assigned to this venue at this time.');
    }

    const assignment = await prisma.venueAssignment.create({
      data: { examinationSessionId, venueId, invigilatorId, slotAt: new Date(slotAt) },
      select: publicSelect,
    });

    await createNotification({
      userId: invigilatorId,
      type: 'INVIGILATION_ASSIGNED',
      title: 'Examination Invigilation Duty',
      message: `You have been assigned to ${assignment.venue.name} on ${new Date(slotAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}. Review your duty schedule for details.`,
      link: '/my-assignments',
      data: { examinationSessionId, venueId },
    }).catch(() => {});

    logAudit({
      actorId: actor.id,
      action: 'VENUE_ASSIGNMENT.MANUAL_ASSIGN',
      targetType: 'VenueAssignment',
      targetId: assignment.id,
      result: 'SUCCESS',
      metadata: { examinationSessionId, venueId, invigilatorId },
    });

    return assignment;
  },

  async removeAssignment(assignmentId, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only exam officers can remove invigilator assignments.');
    }

    const assignment = await prisma.venueAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw ApiError.notFound('Assignment not found.');

    await prisma.venueAssignment.delete({ where: { id: assignmentId } });

    logAudit({
      actorId: actor.id,
      action: 'VENUE_ASSIGNMENT.REMOVE',
      targetType: 'VenueAssignment',
      targetId: assignmentId,
      result: 'SUCCESS',
    });

    return { success: true };
  },

  async list({ examinationSessionId, venueId, invigilatorId } = {}, actor) {
    const where = {
      ...(examinationSessionId ? { examinationSessionId } : {}),
      ...(venueId ? { venueId } : {}),
      ...(invigilatorId ? { invigilatorId } : {}),
    };

    if (actor?.role === 'INVIGILATOR') {
      where.invigilatorId = actor.id;
    }

    const assignments = await prisma.venueAssignment.findMany({
      where,
      orderBy: [{ slotAt: 'asc' }, { venueId: 'asc' }],
      select: publicSelect,
    });

    if (assignments.length === 0 || !examinationSessionId) return assignments;

    const invigilations = await prisma.invigilation.findMany({
      where: { examinationSessionId },
      select: {
        venueId: true,
        scheduledAt: true,
        course: { select: { id: true, code: true, title: true } },
      },
    });

    const courseByVenueSlot = new Map();
    for (const inv of invigilations) {
      const slotHour = getTimeSlotHour(inv.scheduledAt);
      const dateStr = new Date(inv.scheduledAt).toDateString();
      const key = `${inv.venueId}_${dateStr}_${slotHour}`;
      if (!courseByVenueSlot.has(key)) courseByVenueSlot.set(key, []);
      const existing = courseByVenueSlot.get(key);
      if (!existing.some((c) => c.id === inv.course.id)) {
        existing.push(inv.course);
      }
    }

    return assignments.map((a) => {
      const slotHour = getTimeSlotHour(a.slotAt);
      const dateStr = new Date(a.slotAt).toDateString();
      const key = `${a.venue?.id}_${dateStr}_${slotHour}`;
      return { ...a, courses: courseByVenueSlot.get(key) || [] };
    });
  },

  async myAssignments(actor) {
    const assignments = await prisma.venueAssignment.findMany({
      where: { invigilatorId: actor.id },
      orderBy: [{ slotAt: 'asc' }],
      select: publicSelect,
    });

    if (assignments.length === 0) return assignments;

    const sessionIds = [...new Set(assignments.map((a) => a.examinationSession.id))];
    const invigilations = await prisma.invigilation.findMany({
      where: { examinationSessionId: { in: sessionIds } },
      select: {
        examinationSessionId: true,
        venueId: true,
        scheduledAt: true,
        course: { select: { id: true, code: true, title: true } },
      },
    });

    const courseByVenueSlot = new Map();
    for (const inv of invigilations) {
      const slotHour = getTimeSlotHour(inv.scheduledAt);
      const dateStr = new Date(inv.scheduledAt).toDateString();
      const key = `${inv.venueId}_${inv.examinationSessionId}_${dateStr}_${slotHour}`;
      if (!courseByVenueSlot.has(key)) courseByVenueSlot.set(key, []);
      const existing = courseByVenueSlot.get(key);
      if (!existing.some((c) => c.id === inv.course.id)) {
        existing.push(inv.course);
      }
    }

    return assignments.map((a) => {
      const slotHour = getTimeSlotHour(a.slotAt);
      const dateStr = new Date(a.slotAt).toDateString();
      const key = `${a.venue.id}_${a.examinationSession.id}_${dateStr}_${slotHour}`;
      return { ...a, courses: courseByVenueSlot.get(key) || [] };
    });
  },

  async invigilatorCount() {
    return prisma.user.count({
      where: { role: 'INVIGILATOR', status: 'ACTIVE' },
    });
  },

  async todayCount(invigilatorId) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return prisma.venueAssignment.count({
      where: {
        invigilatorId,
        slotAt: { gte: startOfDay, lte: endOfDay },
      },
    });
  },
};
