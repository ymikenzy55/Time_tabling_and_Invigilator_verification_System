import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';
import { createNotification } from '../notifications/notifications.service.js';
import { sendEmail } from '../../utils/email.js';
import { primaryClientOrigin } from '../../config/env.js';
import { broadcast } from '../../utils/broadcast.js';

const publicSelect = {
  id: true,
  slotAt: true,
  createdAt: true,
  venue: { select: { id: true, name: true, capacity: true, location: true } },
  invigilator: { select: { id: true, fullName: true, email: true, staffId: true, departmentName: true } },
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
      select: { id: true, fullName: true, email: true, staffId: true, departmentId: true, isDemo: true },
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

    // ── Demo invigilator auto-assignment ──────────────────────────────
    // Demo invigilators get assigned to 3 different venues per day (one per
    // time slot: 8AM, 11AM, 2PM) so they can scan at any time for demos.
    const demoInvigilators = invigilators.filter((i) => i.isDemo);

    if (demoInvigilators.length > 0 && venueSlotGroups.size > 0) {
      // Group venue slots by day
      const dayGroups = new Map(); // dateStr -> [{ venueId, slotAt }]
      for (const [, group] of venueSlotGroups) {
        const dateStr = new Date(group.slotAt).toDateString();
        if (!dayGroups.has(dateStr)) dayGroups.set(dateStr, []);
        dayGroups.get(dateStr).push(group);
      }

      for (const demoInv of demoInvigilators) {
        for (const [, daySlots] of dayGroups) {
          // Sort slots by time
          daySlots.sort((a, b) => new Date(a.slotAt) - new Date(b.slotAt));

          // Pick up to 3 different venues for this day (one per time slot)
          const usedVenues = new Set();
          let picked = 0;
          for (const slot of daySlots) {
            if (picked >= 3) break;
            if (usedVenues.has(slot.venueId)) continue;
            usedVenues.add(slot.venueId);

            // Check no conflict
            const existingSlots = invigilatorSlots.get(demoInv.id) || [];
            const hasConflict = existingSlots.some((s) => isSameTimeSlot(s.slotAt, slot.slotAt));
            if (hasConflict) continue;

            assignmentRows.push({
              examinationSessionId,
              venueId: slot.venueId,
              invigilatorId: demoInv.id,
              slotAt: slot.slotAt,
            });
            existingSlots.push({ slotAt: slot.slotAt, venueId: slot.venueId });
            invigilatorSlots.set(demoInv.id, existingSlots);
            picked++;
          }
        }
      }
    }

    if (assignmentRows.length > 0) {
      await prisma.venueAssignment.createMany({
        data: assignmentRows,
        skipDuplicates: true,
      });
    }

    // Batch notification creation for better performance
    const notified = new Set();
    const notificationPromises = [];
    
    for (const row of assignmentRows) {
      if (notified.has(row.invigilatorId)) continue;
      notified.add(row.invigilatorId);

      notificationPromises.push(
        createNotification({
          userId: row.invigilatorId,
          type: 'INVIGILATION_ASSIGNED',
          title: 'Examination Invigilation Duty',
          message: 'You have been assigned invigilation duties for upcoming examinations. Review your duty schedule for venue and time details.',
          link: '/my-assignments',
          data: { examinationSessionId },
        }).catch(() => {})
      );

      // Send email notification
      const invigilator = invigilators.find((i) => i.id === row.invigilatorId);
      if (invigilator && invigilator.email) {
        const myAssignments = assignmentRows.filter((r) => r.invigilatorId === row.invigilatorId);
        const venueList = [...new Set(myAssignments.map((r) => r.venue?.name || 'TBD'))];
        sendEmail({
          to: invigilator.email,
          subject: 'Invigilation Duty Assignment — UENR Examination System',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #3730a3; margin: 0;">Invigilation Duty Assigned</h2>
              </div>
              <p style="color: #475569; font-size: 15px;">
                Hello <strong>${invigilator.fullName}</strong>,
              </p>
              <p style="color: #475569; font-size: 15px;">
                You have been assigned invigilation duties for the upcoming examination period.
              </p>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                  <strong>Session:</strong> ${session.name}
                </p>
                <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                  <strong>Venues:</strong> ${venueList.join(', ')}
                </p>
                <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                  <strong>Assignments:</strong> ${myAssignments.length}
                </p>
              </div>
              <p style="color: #475569; font-size: 15px;">
                Please review your complete duty schedule for dates, times, and venue details.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${primaryClientOrigin}/my-assignments"
                   style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">
                  View My Assignments
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
              <p style="color: #94a3b8; font-size: 12px;">
                University of Energy and Natural Resources<br>
                Examination Management System
              </p>
            </div>
          `,
        }).catch((err) => {
          console.error('[venueAssignments] Failed to send assignment email:', err);
        });
      }
    }

    // Execute all notifications in parallel
    await Promise.all(notificationPromises);

    // Broadcast real-time update to each assigned invigilator
    for (const invigilatorId of notified) {
      broadcast.toUser(invigilatorId, 'venue-assignment-updated', { examinationSessionId });
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
    const dayStart = new Date(Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate()));
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

    // Broadcast real-time update to the assigned invigilator
    broadcast.toUser(invigilatorId, 'venue-assignment-updated', { examinationSessionId });

    // Send email notification
    if (assignment.invigilator?.email) {
      sendEmail({
        to: assignment.invigilator.email,
        subject: 'Invigilation Duty Assignment — UENR Examination System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #3730a3; margin: 0;">Invigilation Duty Assigned</h2>
            </div>
            <p style="color: #475569; font-size: 15px;">
              Hello <strong>${assignment.invigilator.fullName}</strong>,
            </p>
            <p style="color: #475569; font-size: 15px;">
              You have been manually assigned an invigilation duty.
            </p>
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Venue:</strong> ${assignment.venue.name}
              </p>
              <p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Date:</strong> ${new Date(slotAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              ${assignment.venue.location ? `<p style="color: #374151; font-size: 14px; margin: 8px 0;">
                <strong>Location:</strong> ${assignment.venue.location}
              </p>` : ''}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${primaryClientOrigin}/my-assignments"
                 style="background: #4f46e5; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">
                View My Assignments
              </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #94a3b8; font-size: 12px;">
              University of Energy and Natural Resources<br>
              Examination Management System
            </p>
          </div>
        `,
      }).catch((err) => {
        console.error('[venueAssignments] Failed to send manual assignment email:', err);
      });
    }

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

    // Broadcast real-time update to the affected invigilator
    broadcast.toUser(assignment.invigilatorId, 'venue-assignment-updated', {});

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

    if (assignments.length === 0) return assignments;

    // Derive examinationSessionId from assignments if not explicitly provided
    const sessionId = examinationSessionId || assignments[0]?.examinationSession?.id;
    if (!sessionId) return assignments;

    const invigilations = await prisma.invigilation.findMany({
      where: { examinationSessionId: sessionId },
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
