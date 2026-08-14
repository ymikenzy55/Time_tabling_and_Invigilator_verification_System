import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAudit } from '../../utils/auditLog.js';

// Fixed daily exam periods: 8-11am, 11am-2pm, 2-5pm.
const EXAM_PERIODS = [
  { startHour: 8, label: '8:00 AM - 11:00 AM' },
  { startHour: 11, label: '11:00 AM - 2:00 PM' },
  { startHour: 14, label: '2:00 PM - 5:00 PM' },
];
const SLOT_MINUTES = 180;
const MIN_VENUES = 3;

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const isWeekend = (date) => {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
};

/**
 * Build all candidate slots between startDate and endDate (inclusive),
 * skipping weekends when requested. Each slot carries a unique key so
 * per-slot occupancy maps stay O(1).
 */
const buildSlots = (startDate, endDate, { skipWeekends = true } = {}) => {
  const slots = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (skipWeekends && isWeekend(d)) continue;
    for (const period of EXAM_PERIODS) {
      const ts = new Date(d);
      ts.setHours(period.startHour, 0, 0, 0);
      slots.push({
        key: ts.getTime(),
        timestamp: ts.getTime(),
        label: period.label,
      });
    }
  }
  return slots;
};

/**
 * Constraint-based scheduler (greedy first-fit-decreasing with per-slot state).
 *
 * Hard constraints enforced:
 *  1. A course's student count must never exceed its venue's capacity.
 *  2. Courses may share a venue in the same slot only while the combined
 *     student count stays within the venue's capacity. This applies across
 *     departments.
 *  3. No two exams for the same department + level can run in the same slot.
 *  4. A course is scheduled exactly once.
 *  5. A department + level can only sit ONE exam per day.
 *
 * Soft constraint (best-effort, never causes scheduling failures):
 *  6. After a dept+level sits an exam, the next 1-3 days are randomly
 *     skipped to create natural rest intervals. ~55% chance to skip the
 *     next day, ~25% chance to also skip 2 days, ~10% chance to skip 3+.
 *     Consecutive-day exams still happen but are not the norm.
 *     A two-pass fallback ensures the soft constraint never prevents
 *     a course from being scheduled.
 *
 * Slots are shuffled so courses are distributed evenly across all three
 * daily periods (morning, midday, evening) instead of packing into the
 * first period. Venues are sorted by capacity ascending so the first
 * venue that fits is the best-fit (smallest suitable), giving O(1)
 * amortized venue selection instead of O(venues) per slot.
 */

const dateKeyOf = (slot) => {
  const d = new Date(slot.key);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const scheduleCourses = (courses, slots, venues) => {
  // Largest classes first — they are the hardest to place.
  const ordered = [...courses].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));

  // Sort venues by capacity ascending — first fit = best-fit (smallest that works).
  const sortedVenues = [...venues].sort((a, b) => a.capacity - b.capacity);

  // Shuffle slots so courses spread evenly across periods and days.
  const shuffledSlots = shuffle([...slots]);

  // slotKey -> Map(venueId -> remaining capacity)
  const venueRemaining = new Map();
  // slotKey -> Set("deptId:level")
  const deptLevelBusy = new Map();
  // dateKey -> Set("deptId:level")
  const deptLevelDayBusy = new Map();
  // "deptId:level" -> last scheduled dateKey
  const deptLevelLastDate = new Map();

  const placements = [];
  const unscheduled = [];

  // Shared placement logic — tries to place a course in a slot, returns true if placed.
  const tryPlace = (course, slot, deptLevelKey, useGapConstraint) => {
    // Hard: no same dept+level in same slot
    const busy = deptLevelBusy.get(slot.key);
    if (busy && busy.has(deptLevelKey)) return false;

    // Hard: one exam per day per dept+level
    const dk = dateKeyOf(slot);
    const dayBusy = deptLevelDayBusy.get(dk);
    if (dayBusy && dayBusy.has(deptLevelKey)) return false;

    // Soft: random gap after last exam day
    if (useGapConstraint) {
      const lastDate = deptLevelLastDate.get(deptLevelKey);
      if (lastDate !== undefined) {
        const diffDays = Math.round((dk - lastDate) / 86_400_000);
        if (diffDays === 1 && Math.random() < 0.55) return false;
        if (diffDays === 2 && Math.random() < 0.25) return false;
        if (diffDays === 3 && Math.random() < 0.10) return false;
      }
    }

    // Find first venue that fits (venues sorted ascending = best-fit)
    let remaining = venueRemaining.get(slot.key);
    if (!remaining) {
      remaining = new Map(sortedVenues.map((v) => [v.id, v.capacity]));
      venueRemaining.set(slot.key, remaining);
    }

    let chosenVenue = null;
    let chosenLeft = 0;
    for (const venue of sortedVenues) {
      const left = remaining.get(venue.id);
      if (left >= course.studentCount && course.studentCount <= venue.capacity) {
        chosenVenue = venue;
        chosenLeft = left;
        break;
      }
    }
    if (!chosenVenue) return false;

    remaining.set(chosenVenue.id, chosenLeft - course.studentCount);
    if (!deptLevelBusy.has(slot.key)) deptLevelBusy.set(slot.key, new Set());
    deptLevelBusy.get(slot.key).add(deptLevelKey);
    if (!deptLevelDayBusy.has(dk)) deptLevelDayBusy.set(dk, new Set());
    deptLevelDayBusy.get(dk).add(deptLevelKey);
    deptLevelLastDate.set(deptLevelKey, dk);

    placements.push({ course, slot, venue: chosenVenue });
    return true;
  };

  for (const course of ordered) {
    const deptLevelKey = `${course.departmentId}:${course.level}`;
    let placed = false;

    // --- Pass 1: with gap soft constraint ---
    for (const slot of shuffledSlots) {
      if (tryPlace(course, slot, deptLevelKey, true)) { placed = true; break; }
    }

    if (placed) continue;

    // --- Pass 2: fallback without gap constraint ---
    for (const slot of shuffledSlots) {
      if (tryPlace(course, slot, deptLevelKey, false)) { placed = true; break; }
    }

    if (!placed) {
      unscheduled.push({
        id: course.id,
        code: course.code,
        title: course.title,
        studentCount: course.studentCount || 0,
        reason: (course.studentCount || 0) > sortedVenues[sortedVenues.length - 1].capacity
          ? 'Student count exceeds every venue capacity.'
          : 'No conflict-free slot with enough venue capacity in the selected period.',
      });
    }
  }

  return { placements, unscheduled };
};

export const timetableService = {
  /**
   * Combined initial data for the timetable page — returns sessions, the
   * default session's entries, and readiness in a single round-trip.
   * Eliminates the sessions → setSessionId → entries waterfall.
   */
  async initialData(actor) {
    // Lightweight session list (no _count subquery).
    const sessions = await prisma.examinationSession.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isPublished: true,
        semester: { select: { id: true, name: true, academicYear: { select: { id: true, name: true } } } },
      },
    });

    if (!sessions.length) {
      return { sessions: [], defaultSessionId: null, entries: [], readiness: null };
    }

    const defaultSessionId = sessions[0].id;

    // Fetch entries and readiness in parallel.
    const [entries, readiness] = await Promise.all([
      prisma.invigilation.findMany({
        where: { examinationSessionId: defaultSessionId },
        select: {
          id: true,
          scheduledAt: true,
          course: {
            select: {
              id: true, code: true, title: true, level: true, studentCount: true,
              instructorName: true, examDurationMinutes: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
          venue: { select: { id: true, name: true } },
        },
        orderBy: [{ scheduledAt: 'asc' }],
      }),
      actor.role === 'SUPER_ADMIN'
        ? (async () => {
            const fullSession = await prisma.examinationSession.findUnique({
              where: { id: defaultSessionId },
              select: { semesterId: true },
            });
            if (!fullSession) return null;
            const [approved, pending, venues] = await Promise.all([
              prisma.course.count({ where: { semesterId: fullSession.semesterId, status: 'APPROVED' } }),
              prisma.course.count({ where: { semesterId: fullSession.semesterId, status: 'SUBMITTED' } }),
              prisma.venue.count({ where: { isActive: true } }),
            ]);
            return {
              approved, pending, venues,
              minVenues: MIN_VENUES,
              ready: approved > 0 && pending === 0 && venues >= MIN_VENUES,
            };
          })()
        : Promise.resolve(null),
    ]);

    return { sessions, defaultSessionId, entries, readiness };
  },

  async readiness(examinationSessionId, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only super admins can view timetable readiness.');
    }

    const session = await prisma.examinationSession.findUnique({
      where: { id: examinationSessionId },
      include: { semester: true },
    });
    if (!session) throw ApiError.notFound('Examination session not found.');

    const [approved, pending, draft, venues] = await Promise.all([
      prisma.course.count({ where: { semesterId: session.semesterId, status: 'APPROVED' } }),
      prisma.course.count({ where: { semesterId: session.semesterId, status: 'SUBMITTED' } }),
      prisma.course.count({ where: { semesterId: session.semesterId, status: 'DRAFT' } }),
      prisma.venue.count({ where: { isActive: true } }),
    ]);

    return {
      approved,
      pending,
      draft,
      venues,
      minVenues: MIN_VENUES,
      ready: approved > 0 && pending === 0 && venues >= MIN_VENUES,
    };
  },

  /** Saved timetable entries for a session, optionally filtered by department. */
  async list({ examinationSessionId, departmentId } = {}, actor) {
    if (!examinationSessionId) throw ApiError.badRequest('Examination session is required.');

    const entries = await prisma.invigilation.findMany({
      where: {
        examinationSessionId,
        ...(departmentId ? { course: { departmentId } } : {}),
      },
      select: {
        id: true,
        scheduledAt: true,
        course: {
          select: {
            id: true, code: true, title: true, level: true, studentCount: true,
            instructorName: true, examDurationMinutes: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        venue: { select: { id: true, name: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }],
    });

    return entries;
  },

  async generate(examinationSessionId, options = {}, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only super admins can generate timetables.');
    }

    const session = await prisma.examinationSession.findUnique({
      where: { id: examinationSessionId },
      include: { semester: true },
    });
    if (!session) throw ApiError.notFound('Examination session not found.');

    const {
      startDate,
      durationDays,
      endDate,
      skipWeekends = true,
      clearExisting = true,
    } = options;

    // Resolve the exam period: officer sets a start date and either an end
    // date or how many days the exams should last.
    const periodStart = startDate ? new Date(startDate) : new Date(session.startDate);
    let periodEnd;
    if (endDate) {
      periodEnd = new Date(endDate);
    } else if (durationDays) {
      periodEnd = addDays(periodStart, Math.max(1, durationDays) - 1);
    } else {
      periodEnd = new Date(session.endDate);
    }
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw ApiError.badRequest('Invalid exam period dates.');
    }
    if (periodEnd <= periodStart) {
      throw ApiError.badRequest('The exam end date must be after the start date.');
    }
    if (skipWeekends && isWeekend(periodStart)) {
      throw ApiError.badRequest('The exam start date cannot be on a weekend when weekends are skipped.');
    }

    const pendingCount = await prisma.course.count({
      where: { status: 'SUBMITTED', semesterId: session.semesterId },
    });
    if (pendingCount > 0) {
      throw ApiError.badRequest(
        `${pendingCount} course${pendingCount === 1 ? ' is' : 's are'} still awaiting approval. Approve or reject all submitted courses before generating the timetable.`
      );
    }

    // Fetch venues, courses, and clear existing entries in parallel.
    const [venues, courses] = await Promise.all([
      prisma.venue.findMany({
        where: { isActive: true },
        orderBy: { capacity: 'desc' },
      }),
      prisma.course.findMany({
        where: { status: 'APPROVED', semesterId: session.semesterId },
        orderBy: [{ level: 'asc' }, { code: 'asc' }],
      }),
      clearExisting
        ? prisma.invigilation.deleteMany({
            where: { examinationSessionId, invigilatorId: null },
          })
        : Promise.resolve(),
    ]);

    if (venues.length < MIN_VENUES) {
      throw ApiError.badRequest(
        `At least ${MIN_VENUES} active venues are required before generating a timetable. Currently: ${venues.length}. Add venues first.`
      );
    }

    if (!courses.length) throw ApiError.badRequest('No approved courses found for this session semester.');

    const slots = buildSlots(periodStart, periodEnd, { skipWeekends });
    if (!slots.length) throw ApiError.badRequest('No available time slots in the selected date range.');

    // Run the constraint solver in memory, then persist in one batch.
    const { placements, unscheduled } = scheduleCourses(courses, slots, venues);

    const rows = placements.map(({ course, slot, venue }) => {
      const scheduledAt = new Date(slot.timestamp);
      return {
        examinationSessionId,
        courseId: course.id,
        venueId: venue.id,
        scheduledAt,
        windowOpensAt: scheduledAt,
        windowClosesAt: new Date(slot.timestamp + SLOT_MINUTES * 60 * 1000 + 30 * 60 * 1000),
        gracePeriodMin: 30,
      };
    });

    if (rows.length) {
      await prisma.invigilation.createMany({ data: rows });
    }

    logAudit({
      actorId: actor.id,
      action: 'TIMETABLE.GENERATE',
      targetType: 'ExaminationSession',
      targetId: examinationSessionId,
      result: 'SUCCESS',
      metadata: {
        examinationSessionId,
        created: rows.length,
        total: courses.length,
        unscheduled: unscheduled.map((c) => c.code),
      },
    });

    return {
      created: rows.length,
      total: courses.length,
      unscheduled,
      period: { start: periodStart, end: periodEnd },
    };
  },

  /** Update a single timetable entry's venue and/or date/time slot. */
  async updateEntry(entryId, { venueId, scheduledAt }, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only super admins can edit timetable entries.');
    }

    const entry = await prisma.invigilation.findUnique({ where: { id: entryId } });
    if (!entry) throw ApiError.notFound('Timetable entry not found.');

    const data = {};
    if (venueId) {
      const venue = await prisma.venue.findUnique({ where: { id: venueId } });
      if (!venue) throw ApiError.notFound('Venue not found.');
      data.venueId = venueId;
    }
    if (scheduledAt) {
      const dt = new Date(scheduledAt);
      if (Number.isNaN(dt.getTime())) throw ApiError.badRequest('Invalid date/time.');
      data.scheduledAt = dt;
      data.windowOpensAt = dt;
      data.windowClosesAt = new Date(dt.getTime() + SLOT_MINUTES * 60 * 1000 + 30 * 60 * 1000);
    }

    const updated = await prisma.invigilation.update({
      where: { id: entryId },
      data,
      include: {
        course: { select: { id: true, code: true, title: true, level: true, studentCount: true, instructorName: true, department: { select: { id: true, name: true, code: true } } } },
        venue: { select: { id: true, name: true, capacity: true, location: true } },
      },
    });

    logAudit({
      actorId: actor.id,
      action: 'TIMETABLE.ENTRY_UPDATE',
      targetType: 'Invigilation',
      targetId: entryId,
      result: 'SUCCESS',
      metadata: { venueId, scheduledAt },
    });

    return updated;
  },

  /** Delete a single timetable entry. */
  async deleteEntry(entryId, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only super admins can delete timetable entries.');
    }

    try {
      await prisma.invigilation.delete({ where: { id: entryId } });
    } catch (err) {
      if (err.code === 'P2025') throw ApiError.notFound('Timetable entry not found.');
      throw err;
    }

    logAudit({
      actorId: actor.id,
      action: 'TIMETABLE.ENTRY_DELETE',
      targetType: 'Invigilation',
      targetId: entryId,
      result: 'SUCCESS',
    });

    return { id: entryId };
  },

  /** Delete the entire timetable (all entries) for an examination session. */
  async deleteTimetable(examinationSessionId, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only super admins can delete timetables.');
    }

    const session = await prisma.examinationSession.findUnique({ where: { id: examinationSessionId } });
    if (!session) throw ApiError.notFound('Examination session not found.');

    const [result] = await Promise.all([
      prisma.invigilation.deleteMany({ where: { examinationSessionId } }),
      prisma.venueAssignment.deleteMany({ where: { examinationSessionId } }).catch(() => {}),
    ]);

    logAudit({
      actorId: actor.id,
      action: 'TIMETABLE.DELETE',
      targetType: 'ExaminationSession',
      targetId: examinationSessionId,
      result: 'SUCCESS',
      metadata: { deleted: result.count },
    });

    return { deleted: result.count };
  },
};
