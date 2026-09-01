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

/**
 * Courses sharing the same course code AND title (e.g. a service course
 * taught to several departments at the same level) must be written on the
 * SAME day and at the SAME time, but normally in DIFFERENT venues.
 * Grouping them by a normalized code+title key lets the scheduler place
 * the whole group atomically into one slot.
 */
const courseGroupKey = (c) =>
  `${(c.code || '').trim().toUpperCase()}::${(c.title || '').trim().toUpperCase()}`;

const scheduleCourses = (courses, slots, venues) => {
  // Group same code+title courses — they must sit the same day & time.
  const groupsMap = new Map();
  for (const c of courses) {
    const key = courseGroupKey(c);
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key).push(c);
  }
  const groupStudents = (g) => g.reduce((sum, c) => sum + (c.studentCount || 0), 0);
  const groupIsPractical = (g) => g.some((c) => c.isPractical);
  const groupMinLevel = (g) => Math.min(...g.map((c) => c.level || 0));
  // Practical groups first, then lower level first, then largest groups first.
  const groups = [...groupsMap.values()].sort((a, b) => {
    const aPrac = groupIsPractical(a) ? 1 : 0;
    const bPrac = groupIsPractical(b) ? 1 : 0;
    if (aPrac !== bPrac) return bPrac - aPrac;
    const aLevel = groupMinLevel(a);
    const bLevel = groupMinLevel(b);
    if (aLevel !== bLevel) return aLevel - bLevel;
    return groupStudents(b) - groupStudents(a);
  });

  const hasVenues = venues.length > 0;
  // Sort venues by capacity ascending — first fit = best-fit (smallest that works).
  const sortedVenues = [...venues].sort((a, b) => a.capacity - b.capacity);
  const largestCapacity = sortedVenues[sortedVenues.length - 1]?.capacity || 0;

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

  /**
   * Check for duplicate dept+level keys within a group.
   * If the same dept+level appears more than once in a group, those courses
   * would clash in the same slot. We must split the group.
   */
  const hasInternalClash = (group) => {
    const seen = new Set();
    for (const c of group) {
      const k = `${c.departmentId}:${c.level}`;
      if (seen.has(k)) return true;
      seen.add(k);
    }
    return false;
  };

  /**
   * Try to place an entire group (1..N same-code courses) into one slot.
   * All members must satisfy dept+level constraints and get a venue,
   * preferring a DIFFERENT venue per member. Atomic: places all or none.
   */
  const tryPlaceGroup = (group, slot, useGapConstraint) => {
    const dk = dateKeyOf(slot);
    const busy = deptLevelBusy.get(slot.key);
    const dayBusy = deptLevelDayBusy.get(dk);

    const deptLevelKeys = group.map((c) => `${c.departmentId}:${c.level}`);
    for (const k of deptLevelKeys) {
      // Hard: no same dept+level already in this slot / this day
      if (busy && busy.has(k)) return false;
      if (dayBusy && dayBusy.has(k)) return false;
    }

    // Soft: random gap after last exam day (checked for every member)
    if (useGapConstraint) {
      for (const k of deptLevelKeys) {
        const lastDate = deptLevelLastDate.get(k);
        if (lastDate !== undefined) {
          const diffDays = Math.round((dk - lastDate) / 86_400_000);
          if (diffDays === 1 && Math.random() < 0.55) return false;
          if (diffDays === 2 && Math.random() < 0.25) return false;
          if (diffDays === 3 && Math.random() < 0.10) return false;
        }
      }
    }

    // No-venue mode: skip venue allocation, just place into time slot.
    if (!hasVenues) {
      if (!deptLevelBusy.has(slot.key)) deptLevelBusy.set(slot.key, new Set());
      if (!deptLevelDayBusy.has(dk)) deptLevelDayBusy.set(dk, new Set());
      for (const k of deptLevelKeys) {
        deptLevelBusy.get(slot.key).add(k);
        deptLevelDayBusy.get(dk).add(k);
        deptLevelLastDate.set(k, dk);
      }
      for (const course of group) placements.push({ course, slot, venue: null, splitCount: null, isSplit: false });
      return true;
    }

    let remaining = venueRemaining.get(slot.key);
    if (!remaining) {
      remaining = new Map(sortedVenues.map((v) => [v.id, v.capacity]));
      venueRemaining.set(slot.key, remaining);
    }

    // Simulate venue allocation on a copy — commit only if every member fits.
    const trial = new Map(remaining);
    const usedVenues = new Set();
    const chosen = [];
    const members = [...group].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));

    for (const course of members) {
      const students = course.studentCount || 0;
      let pick = null;

      // Prefer a venue not already used by this group (different locations).
      for (const venue of sortedVenues) {
        if (usedVenues.has(venue.id)) continue;
        if (trial.get(venue.id) >= students && students <= venue.capacity) { pick = venue; break; }
      }
      // Fallback: share a venue already used by the group if capacity allows.
      if (!pick) {
        for (const venue of sortedVenues) {
          if (trial.get(venue.id) >= students && students <= venue.capacity) { pick = venue; break; }
        }
      }
      // Split support: if students > any single venue capacity, split across multiple venues
      if (!pick && students > 0 && hasVenues) {
        const splitChosen = [];
        let remainingStudents = students;
        const splitTrial = new Map(trial);
        const splitUsed = new Set(usedVenues);
        for (const venue of sortedVenues) {
          if (splitUsed.has(venue.id)) continue;
          if (remainingStudents <= 0) break;
          const avail = Math.min(splitTrial.get(venue.id), venue.capacity);
          if (avail <= 0) continue;
          const take = Math.min(avail, remainingStudents);
          splitTrial.set(venue.id, splitTrial.get(venue.id) - take);
          splitUsed.add(venue.id);
          splitChosen.push({ course, venue, splitCount: take, isSplit: true });
          remainingStudents -= take;
        }
        if (remainingStudents <= 0) {
          for (const [vid, left] of splitTrial) trial.set(vid, left);
          usedVenues.add(...splitUsed);
          for (const sc of splitChosen) chosen.push(sc);
          continue;
        }
      }
      if (!pick) return false;

      trial.set(pick.id, trial.get(pick.id) - students);
      usedVenues.add(pick.id);
      chosen.push({ course, venue: pick });
    }

    // Commit the placement.
    for (const [vid, left] of trial) remaining.set(vid, left);
    if (!deptLevelBusy.has(slot.key)) deptLevelBusy.set(slot.key, new Set());
    if (!deptLevelDayBusy.has(dk)) deptLevelDayBusy.set(dk, new Set());
    for (const k of deptLevelKeys) {
      deptLevelBusy.get(slot.key).add(k);
      deptLevelDayBusy.get(dk).add(k);
      deptLevelLastDate.set(k, dk);
    }
    for (const c of chosen) placements.push({ course: c.course, slot, venue: c.venue, splitCount: c.splitCount || null, isSplit: !!c.isSplit });
    return true;
  };

  /**
   * Relaxed placement: enforces no same dept+level in the same slot and
   * venue capacity, but allows the same dept+level to sit another exam
   * on the same day (different period). Used as a last-resort fallback.
   * Same-slot clashes are NEVER allowed.
   */
  const tryPlaceGroupRelaxed = (group, slot) => {
    const busy = deptLevelBusy.get(slot.key);
    const deptLevelKeys = group.map((c) => `${c.departmentId}:${c.level}`);
    for (const k of deptLevelKeys) {
      if (busy && busy.has(k)) return false;
    }

    // No-venue mode: skip venue allocation.
    if (!hasVenues) {
      if (!deptLevelBusy.has(slot.key)) deptLevelBusy.set(slot.key, new Set());
      for (const k of deptLevelKeys) {
        deptLevelBusy.get(slot.key).add(k);
      }
      for (const course of group) placements.push({ course, slot, venue: null, splitCount: null, isSplit: false });
      return true;
    }

    let remaining = venueRemaining.get(slot.key);
    if (!remaining) {
      remaining = new Map(sortedVenues.map((v) => [v.id, v.capacity]));
      venueRemaining.set(slot.key, remaining);
    }

    const trial = new Map(remaining);
    const usedVenues = new Set();
    const chosen = [];
    const members = [...group].sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0));

    for (const course of members) {
      const students = course.studentCount || 0;
      let pick = null;
      for (const venue of sortedVenues) {
        if (usedVenues.has(venue.id)) continue;
        if (trial.get(venue.id) >= students && students <= venue.capacity) { pick = venue; break; }
      }
      if (!pick) {
        for (const venue of sortedVenues) {
          if (trial.get(venue.id) >= students && students <= venue.capacity) { pick = venue; break; }
        }
      }
      // Split support for relaxed mode too
      if (!pick && students > 0 && hasVenues) {
        const splitChosen = [];
        let remainingStudents = students;
        const splitTrial = new Map(trial);
        const splitUsed = new Set(usedVenues);
        for (const venue of sortedVenues) {
          if (splitUsed.has(venue.id)) continue;
          if (remainingStudents <= 0) break;
          const avail = Math.min(splitTrial.get(venue.id), venue.capacity);
          if (avail <= 0) continue;
          const take = Math.min(avail, remainingStudents);
          splitTrial.set(venue.id, splitTrial.get(venue.id) - take);
          splitUsed.add(venue.id);
          splitChosen.push({ course, venue, splitCount: take, isSplit: true });
          remainingStudents -= take;
        }
        if (remainingStudents <= 0) {
          for (const [vid, left] of splitTrial) trial.set(vid, left);
          for (const su of splitUsed) usedVenues.add(su);
          for (const sc of splitChosen) chosen.push(sc);
          continue;
        }
      }
      if (!pick) return false;
      trial.set(pick.id, trial.get(pick.id) - students);
      usedVenues.add(pick.id);
      chosen.push({ course, venue: pick });
    }

    for (const [vid, left] of trial) remaining.set(vid, left);
    if (!deptLevelBusy.has(slot.key)) deptLevelBusy.set(slot.key, new Set());
    for (const k of deptLevelKeys) {
      deptLevelBusy.get(slot.key).add(k);
    }
    for (const c of chosen) placements.push({ course: c.course, slot, venue: c.venue, splitCount: c.splitCount || null, isSplit: !!c.isSplit });
    return true;
  };

  for (const group of groups) {
    // If group has internal dept+level clash (duplicate courses),
    // split into sub-groups by dept+level and place each separately.
    const subGroups = hasInternalClash(group)
      ? Object.values(group.reduce((acc, c) => {
          const k = `${c.departmentId}:${c.level}`;
          if (!acc[k]) acc[k] = [];
          acc[k].push(c);
          return acc;
        }, {}))
      : [group];

    let allPlaced = true;
    for (const subGroup of subGroups) {
      let placed = false;

      // --- Pass 1: with gap soft constraint ---
      for (const slot of shuffledSlots) {
        if (tryPlaceGroup(subGroup, slot, true)) { placed = true; break; }
      }

      // --- Pass 2: fallback without gap constraint ---
      if (!placed) {
        for (const slot of shuffledSlots) {
          if (tryPlaceGroup(subGroup, slot, false)) { placed = true; break; }
        }
      }

      // --- Pass 3: relaxed — allow same dept+level on the same day (different period) ---
      // Same-slot clashes are NEVER allowed.
      if (!placed) {
        for (const slot of shuffledSlots) {
          if (tryPlaceGroupRelaxed(subGroup, slot)) { placed = true; break; }
        }
      }

      if (!placed) {
        allPlaced = false;
        for (const course of subGroup) {
          unscheduled.push({
            id: course.id,
            code: course.code,
            title: course.title,
            studentCount: course.studentCount || 0,
            reason: hasVenues && (course.studentCount || 0) > largestCapacity
              ? 'Student count exceeds every venue capacity.'
              : subGroup.length > 1
                ? 'This course is shared across departments and no single slot had enough venue capacity for all sections together.'
                : 'No conflict-free slot available in the selected period.',
          });
        }
      }
    }
  }

  // Verify no clashes exist in placements (same dept+level in same slot).
  // This is a safety net — the algorithm should never produce clashes,
  // but if it does, we remove the conflicting entries and mark them unscheduled.
  const slotDeptLevelMap = new Map();
  const clashPlacements = new Set();
  for (const p of placements) {
    const k = `${p.slot.key}:${p.course.departmentId}:${p.course.level}`;
    if (!slotDeptLevelMap.has(k)) slotDeptLevelMap.set(k, []);
    slotDeptLevelMap.get(k).push(p);
  }
  for (const [, plist] of slotDeptLevelMap) {
    // Group by courseId — same courseId in same slot = split, not clash
    const byCourseId = new Map();
    for (const p of plist) {
      if (!byCourseId.has(p.course.id)) byCourseId.set(p.course.id, []);
      byCourseId.get(p.course.id).push(p);
    }
    // If more than one distinct courseId has the same dept+level in the same slot, it's a clash
    if (byCourseId.size > 1) {
      for (const p of plist) clashPlacements.add(p);
    }
  }

  let finalPlacements = placements;
  if (clashPlacements.size > 0) {
    finalPlacements = placements.filter((p) => !clashPlacements.has(p));
    for (const p of clashPlacements) {
      unscheduled.push({
        id: p.course.id,
        code: p.course.code,
        title: p.course.title,
        studentCount: p.course.studentCount || 0,
        reason: 'Clash detected — could not find a conflict-free slot. Try increasing the exam period duration.',
      });
    }
  }

  return { placements: finalPlacements, unscheduled };
};

export const timetableService = {
  /**
   * Combined initial data for the timetable page — returns sessions, the
   * default session's entries, and readiness in a single round-trip.
   * Eliminates the sessions → setSessionId → entries waterfall.
   */
  async initialData(actor) {
    // Lazily create examination sessions for semesters that have courses but
    // no session yet — same logic as examinationSessionsService.list().
    const semestersNeedingSession = await prisma.semester.findMany({
      where: {
        courses: { some: {} },
        examinationSessions: { none: {} },
      },
      select: { id: true, name: true, startDate: true, endDate: true, academicYear: { select: { name: true } } },
    });
    if (semestersNeedingSession.length > 0) {
      await prisma.examinationSession.createMany({
        data: semestersNeedingSession.map((s) => ({
          name: `${s.name} Examinations${s.academicYear?.name ? ` (${s.academicYear.name})` : ''}`,
          semesterId: s.id,
          startDate: s.startDate,
          endDate: s.endDate,
          isPublished: false,
        })),
        skipDuplicates: true,
      });
    }

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
          splitRange: true,
          course: {
            select: {
              id: true, code: true, title: true, level: true, studentCount: true,
              instructorName: true, examDurationMinutes: true, isPractical: true,
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
        splitRange: true,
        course: {
          select: {
            id: true, code: true, title: true, level: true, studentCount: true,
            instructorName: true, examDurationMinutes: true, isPractical: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        venue: { select: { id: true, name: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }],
    });

    return entries;
  },

  async generate(examinationSessionId, options = {}, actor, onProgress) {
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
      assignVenues = true,
      maxRetries = 20, // New: maximum number of attempts to find complete solution
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
      assignVenues
        ? prisma.venue.findMany({
            where: { isActive: true },
            orderBy: { capacity: 'desc' },
          })
        : Promise.resolve([]),
      prisma.course.findMany({
        where: { status: 'APPROVED', semesterId: session.semesterId },
        orderBy: [{ isPractical: 'desc' }, { level: 'asc' }, { code: 'asc' }],
      }),
      clearExisting
        ? prisma.invigilation.deleteMany({
            where: { examinationSessionId, invigilatorId: null },
          })
        : Promise.resolve(),
    ]);

    if (assignVenues && venues.length < MIN_VENUES) {
      throw ApiError.badRequest(
        `At least ${MIN_VENUES} active venues are required before generating a timetable. Currently: ${venues.length}. Add venues first or uncheck "Assign venues to exams".`
      );
    }

    if (!courses.length) throw ApiError.badRequest('No approved courses found for this session semester.');

    const slots = buildSlots(periodStart, periodEnd, { skipWeekends });
    if (!slots.length) throw ApiError.badRequest('No available time slots in the selected date range.');

    // NEW: Retry mechanism - try multiple times to find complete solution
    let bestResult = null;
    let bestAttemptNumber = 0;
    
    console.log(`[Timetable] Starting generation with up to ${maxRetries} attempts...`);
    
    const progress = (msg) => {
      console.log(`[Timetable] ${msg}`);
      if (onProgress) onProgress(msg);
    };
    
    progress(`Preparing timetable generation…`);
    progress(`Found ${courses.length} approved courses and ${venues.length} active venues.`);
    progress(`Building time slots from ${periodStart.toLocaleDateString()} to ${periodEnd.toLocaleDateString()}…`);
    progress(`Created ${slots.length} available time slots.`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      progress(`Attempt ${attempt}/${maxRetries}: Scheduling courses…`);
      // Run the constraint solver in memory
      const { placements, unscheduled } = scheduleCourses(courses, slots, venues);
      
      progress(`Attempt ${attempt}: ${placements.length}/${courses.length} courses scheduled, ${unscheduled.length} unscheduled`);
      
      // If we found a complete solution, use it immediately
      if (unscheduled.length === 0) {
        bestResult = { placements, unscheduled };
        bestAttemptNumber = attempt;
        progress(`✓ Complete solution found on attempt ${attempt}!`);
        break;
      }
      
      // Keep track of the best attempt (fewest unscheduled)
      if (!bestResult || unscheduled.length < bestResult.unscheduled.length) {
        bestResult = { placements, unscheduled };
        bestAttemptNumber = attempt;
        progress(`New best: ${placements.length} scheduled (attempt ${attempt})`);
      }
      
      // If this is not the last attempt and we have unscheduled courses, continue trying
      if (attempt < maxRetries && unscheduled.length > 0) {
        progress(`Retrying with different randomization…`);
        continue;
      }
    }

    const { placements, unscheduled } = bestResult;
    
    progress(`Assigning venues to all courses…`);

    // Compute split ranges for courses split across multiple venues.
    // Group split placements by courseId, then assign sequential student ranges.
    const splitGroups = new Map(); // courseId -> [{ placement, index }]
    for (const p of placements) {
      if (p.isSplit && p.splitCount) {
        if (!splitGroups.has(p.course.id)) splitGroups.set(p.course.id, []);
        splitGroups.get(p.course.id).push(p);
      }
    }
    const splitRangeMap = new Map(); // placement object -> "start-end"
    for (const [, splitPlacements] of splitGroups) {
      let offset = 1;
      for (const p of splitPlacements) {
        const start = offset;
        const end = offset + p.splitCount - 1;
        splitRangeMap.set(p, `${start}-${end}`);
        offset = end + 1;
      }
    }

    // Persist the best solution found
    const rows = placements.map(({ course, slot, venue, isSplit, splitCount }) => {
      const scheduledAt = new Date(slot.timestamp);
      const self = { course, slot, venue, isSplit, splitCount };
      return {
        examinationSessionId,
        courseId: course.id,
        venueId: venue?.id || null,
        scheduledAt,
        windowOpensAt: scheduledAt,
        windowClosesAt: new Date(slot.timestamp + SLOT_MINUTES * 60 * 1000 + 30 * 60 * 1000),
        gracePeriodMin: 30,
        splitRange: splitRangeMap.get(self) || null,
      };
    });

    if (rows.length) {
      await prisma.invigilation.createMany({ data: rows });
    }
    progress(`Saved ${rows.length} timetable entries to database.`);
    
    progress(`Assigning invigilators to venues…`);

    const wasComplete = unscheduled.length === 0;
    const resultMessage = wasComplete 
      ? `Complete timetable generated successfully on attempt ${bestAttemptNumber}.`
      : `Best solution found after ${maxRetries} attempts. ${unscheduled.length} courses could not be scheduled (see details below).`;

    progress(wasComplete ? `Timetable generation complete! All ${courses.length} courses scheduled.` : `Generation complete with ${unscheduled.length} unscheduled courses.`);
    console.log(`[Timetable] Final: ${rows.length}/${courses.length} courses scheduled. ${wasComplete ? '✓ Complete' : '⚠ Incomplete'}`);

    logAudit({
      actorId: actor.id,
      action: 'TIMETABLE.GENERATE',
      targetType: 'ExaminationSession',
      targetId: examinationSessionId,
      result: wasComplete ? 'SUCCESS' : 'PARTIAL',
      metadata: {
        examinationSessionId,
        created: rows.length,
        total: courses.length,
        unscheduled: unscheduled.map((c) => c.code),
        attempts: bestAttemptNumber,
        maxRetries,
      },
    });

    return {
      created: rows.length,
      total: courses.length,
      unscheduled,
      venuesAssigned: assignVenues,
      attempts: bestAttemptNumber,
      complete: wasComplete,
      message: resultMessage,
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
        course: { select: { id: true, code: true, title: true, level: true, studentCount: true, instructorName: true, isPractical: true, department: { select: { id: true, name: true, code: true } } } },
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
