import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { env, primaryClientOrigin } from '../../config/env.js';
import { createNotification, notifyRole } from '../notifications/notifications.service.js';
import { broadcast } from '../../utils/broadcast.js';

const QR_SECRET = env.QR_SIGNING_SECRET || env.JWT_SECRET;
const QR_TOKEN_EXPIRY = '8h';
const VENUE_QR_FALLBACK_EXPIRY = '7d';

export const signQrToken = (invigilationId) =>
  jwt.sign({ invigilationId, type: 'QR_ATTENDANCE' }, QR_SECRET, { expiresIn: QR_TOKEN_EXPIRY });

/**
 * Venue QR tokens are simple, human-readable strings: `VENUE:{venueId}:{sessionId}`.
 * No JWT — the QR encodes the venue code, not a link. The scan endpoint
 * parses the string and validates the invigilator's assignment.
 */
export const signVenueQrToken = (venueId, examinationSessionId) => {
  return `VENUE:${venueId}:${examinationSessionId}`;
};

export const parseVenueQrToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split(':');
  if (parts.length !== 3 || parts[0] !== 'VENUE') return null;
  const [, venueId, examinationSessionId] = parts;
  if (!venueId || !examinationSessionId) return null;
  return { venueId, examinationSessionId, type: 'VENUE_QR' };
};

export const verifyQrToken = (token) => {
  try {
    return jwt.verify(token, QR_SECRET);
  } catch {
    return null;
  }
};

/**
 * Exam time slots: 8–11 AM, 11 AM–2 PM, 2–5 PM.
 * Each slot resets daily, so an invigilator can scan once per slot per day.
 */
const EXAM_TIME_SLOTS = [
  { startHour: 8, endHour: 11, label: '8:00 AM – 11:00 AM' },
  { startHour: 11, endHour: 14, label: '11:00 AM – 2:00 PM' },
  { startHour: 14, endHour: 17, label: '2:00 PM – 5:00 PM' },
];

const getCurrentTimeSlot = (date) => {
  const hour = date.getHours();
  return EXAM_TIME_SLOTS.find((s) => hour >= s.startHour && hour < s.endHour) || null;
};

const isWithinExamPeriod = (session, now) => {
  if (!session) return false;
  const start = new Date(session.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(session.endDate);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
};

/**
 * Check if coordinates are within UENR campus bounds
 * UENR Campus approximate coordinates:
 * Latitude: 7.3° to 7.4° N
 * Longitude: -2.35° to -2.30° W
 */
const isWithinUENRCampus = (latitude, longitude) => {
  // UENR campus boundaries (approximate)
  const UENR_BOUNDS = {
    minLat: 7.30,
    maxLat: 7.40,
    minLng: -2.35,
    maxLng: -2.30,
  };

  const isWithin = latitude >= UENR_BOUNDS.minLat && 
                   latitude <= UENR_BOUNDS.maxLat &&
                   longitude >= UENR_BOUNDS.minLng && 
                   longitude <= UENR_BOUNDS.maxLng;

  return isWithin;
};

/**
 * Run every venue-QR check without touching the database for writes.
 *
 * Shared by `previewVenueScan` (read-only) and `scanVenue` (which persists the
 * outcome), so both always agree on the verdict.
 */
const evaluateVenueScan = async (token, actor) => {
  const payload = parseVenueQrToken(token);
  if (!payload || payload.type !== 'VENUE_QR' || !payload.venueId || !payload.examinationSessionId) {
    return { result: 'REJECTED_INVALID_QR', payload: null, message: 'This QR code is not a valid venue check-in code.' };
  }

  if (actor.role !== 'INVIGILATOR') {
    return {
      result: 'REJECTED_UNASSIGNED',
      payload: null,
      message: 'Only registered invigilators can check in with a venue QR code. If you believe this is an error, contact the exam office.',
    };
  }

  const invigilator = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, role: true, status: true, fullName: true, email: true, staffId: true, isDemo: true },
  });

  if (!invigilator || invigilator.role !== 'INVIGILATOR' || invigilator.status !== 'ACTIVE') {
    return {
      result: 'REJECTED_UNASSIGNED',
      payload,
      message: 'Your account is not an active invigilator account.',
    };
  }

  const venue = await prisma.venue.findUnique({
    where: { id: payload.venueId },
    select: { id: true, name: true, location: true },
  });
  if (!venue) {
    return { result: 'REJECTED_INVALID_QR', payload: null, message: 'The venue on this QR code no longer exists.' };
  }

  // Fetch the examination session to validate exam period and time window.
  const session = await prisma.examinationSession.findUnique({
    where: { id: payload.examinationSessionId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  if (!session) {
    return { result: 'REJECTED_INVALID_QR', payload: null, message: 'The examination session for this QR code no longer exists.' };
  }

  const now = new Date();
  const isDemo = invigilator.isDemo;

  // Enforce exam period — QR only valid during the session date range.
  // Demo invigilators bypass this check.
  if (!isDemo && !isWithinExamPeriod(session, now)) {
    return {
      result: 'REJECTED_WINDOW',
      payload,
      venue,
      invigilator,
      message: `This QR code is only valid during the exam period (${new Date(session.startDate).toLocaleDateString()} – ${new Date(session.endDate).toLocaleDateString()}). Scanning is not available outside this period.`,
    };
  }

  // Verify the invigilator is assigned to THIS venue.
  // Demo invigilators: search any assignment to this venue in the session (no day restriction).
  // Regular invigilators: only search assignments for today.
  let assignment;
  if (isDemo) {
    assignment = await prisma.venueAssignment.findFirst({
      where: {
        invigilatorId: actor.id,
        venueId: payload.venueId,
        examinationSessionId: payload.examinationSessionId,
      },
    });
  } else {
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    assignment = await prisma.venueAssignment.findFirst({
      where: {
        invigilatorId: actor.id,
        venueId: payload.venueId,
        examinationSessionId: payload.examinationSessionId,
        slotAt: { gte: dayStart, lt: dayEnd },
      },
    });
  }

  if (!assignment) {
    // Find where the invigilator IS assigned so we can point them there.
    // Demo invigilators: search all assignments in the session.
    // Regular invigilators: search only today's assignments.
    const fallbackWhere = isDemo
      ? { invigilatorId: actor.id, examinationSessionId: payload.examinationSessionId }
      : { invigilatorId: actor.id, examinationSessionId: payload.examinationSessionId, slotAt: { gte: dayStart, lt: dayEnd } };

    const todayAssignments = await prisma.venueAssignment.findMany({
      where: fallbackWhere,
      orderBy: { slotAt: 'asc' },
      select: {
        slotAt: true,
        venue: { select: { id: true, name: true, location: true } },
      },
    });

    let message;
    if (todayAssignments.length > 0) {
      const venueList = todayAssignments.map((a) => `${a.venue.name}`).join(', ');
      message = `You scanned ${venue.name} but you are not assigned here. Your assigned venue${todayAssignments.length > 1 ? 's are' : ' is'}: ${venueList}. Please go to your assigned venue and scan the QR code there.`;
    } else {
      message = `You are not assigned to ${venue.name}. Please check your assignments or contact the exam officer.`;
    }

    return {
      result: 'REJECTED_VENUE_MISMATCH',
      payload,
      venue,
      invigilator,
      assignedVenue: todayAssignments[0]
        ? { ...todayAssignments[0].venue, slotAt: todayAssignments[0].slotAt }
        : null,
      allAssignedVenues: todayAssignments.map((a) => ({ ...a.venue, slotAt: a.slotAt })),
      message,
    };
  }

  // Check for duplicate scan — same venue, same invigilator, same time slot, already recorded.
  // Only block if a RECORDED scan already exists for this venue + slot.
  if (!isDemo) {
    const slotHour = new Date(assignment.slotAt).getHours();
    const slotLabel = EXAM_TIME_SLOTS.find((s) => slotHour >= s.startHour && slotHour < s.endHour)?.label || 'Exam Session';
    const existingScan = await prisma.venueScan.findFirst({
      where: {
        userId: actor.id,
        venueId: payload.venueId,
        examinationSessionId: payload.examinationSessionId,
        result: 'RECORDED',
        scannedAt: {
          gte: new Date(new Date(assignment.slotAt).getTime() - 60 * 60 * 1000),
          lte: new Date(new Date(assignment.slotAt).getTime() + 4 * 60 * 60 * 1000),
        },
      },
    });
    if (existingScan) {
      return {
        result: 'REJECTED_DUPLICATE',
        payload,
        venue,
        invigilator,
        message: `You have already checked in at ${venue.name} for this time slot (${slotLabel}). Duplicate scans for the same venue and time are not allowed.`,
      };
    }
  }

  // Time window check for regular invigilators: must be within the exam time slot.
  // Demo invigilators bypass this check.
  if (!isDemo) {
    const slotStart = new Date(assignment.slotAt);
    const slotEnd = new Date(slotStart.getTime() + (assignment.examDurationMinutes || 180) * 60 * 1000);
    // Allow scanning 15 minutes before slot start and up to 30 minutes after slot end.
    const windowStart = new Date(slotStart.getTime() - 15 * 60 * 1000);
    const windowEnd = new Date(slotEnd.getTime() + 30 * 60 * 1000);
    if (now < windowStart || now > windowEnd) {
      const sHour = slotStart.getHours();
      const sLabel = EXAM_TIME_SLOTS.find((s) => sHour >= s.startHour && sHour < s.endHour)?.label || 'Exam Session';
      return {
        result: 'REJECTED_WINDOW',
        payload,
        venue,
        invigilator,
        assignment,
        message: `Scanning for ${venue.name} is only allowed during your assigned exam time (${slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Please come back during your exam window.`,
      };
    }
  }

  // Determine the time slot label from the assignment's scheduled time.
  const slotHour = new Date(assignment.slotAt).getHours();
  const slotLabel = EXAM_TIME_SLOTS.find((s) => slotHour >= s.startHour && slotHour < s.endHour)?.label || 'Exam Session';
  return { result: 'RECORDED', payload, venue, invigilator, assignment, timeSlot: slotLabel };
};

const assertQrAccess = (invigilation, actor) => {
  if (actor.role === 'SUPER_ADMIN') return;
  const isAssigned = invigilation.invigilatorId === actor.id || invigilation.replacementId === actor.id;
  if (!isAssigned) throw ApiError.forbidden('You do not have access to this invigilation QR.');
};

const isWithinWindow = (invigilation) => {
  const now = new Date();
  if (invigilation.windowOpensAt && invigilation.windowClosesAt) {
    return now >= new Date(invigilation.windowOpensAt) && now <= new Date(invigilation.windowClosesAt);
  }
  const scheduled = new Date(invigilation.scheduledAt);
  const grace = (invigilation.gracePeriodMin || 0) * 60 * 1000;
  // Allow 15 minutes before the scheduled time and the grace period after.
  const start = new Date(scheduled.getTime() - 15 * 60 * 1000);
  const end = new Date(scheduled.getTime() + grace);
  return now >= start && now <= end;
};

export const attendanceService = {
  async generateQr(invigilationId, actor) {
    const invigilation = await prisma.invigilation.findUnique({
      where: { id: invigilationId },
      select: {
        id: true, scheduledAt: true, windowOpensAt: true, windowClosesAt: true,
        invigilatorId: true, replacementId: true,
        course: { select: { code: true, title: true } },
        examinationSession: { select: { name: true } },
      },
    });
    if (!invigilation) throw ApiError.notFound('Invigilation not found.');
    assertQrAccess(invigilation, actor);

    const token = signQrToken(invigilationId);
    return {
      token,
      link: `${primaryClientOrigin}/scan?token=${encodeURIComponent(token)}`,
      invigilation,
    };
  },

  async scan({ token, ipAddress, userAgent }, actor) {
    const payload = verifyQrToken(token);
    if (!payload || payload.type !== 'QR_ATTENDANCE' || !payload.invigilationId) {
      return { result: 'REJECTED_INVALID_QR' };
    }

    const invigilation = await prisma.invigilation.findUnique({
      where: { id: payload.invigilationId },
      select: {
        id: true, scheduledAt: true, windowOpensAt: true, windowClosesAt: true,
        gracePeriodMin: true, invigilatorId: true, replacementId: true,
      },
    });
    if (!invigilation) {
      return { result: 'REJECTED_INVALID_QR' };
    }

    const isAssigned = invigilation.invigilatorId === actor.id || invigilation.replacementId === actor.id;
    if (!isAssigned) {
      return this.recordAttempt({
        result: 'REJECTED_UNASSIGNED', actor, invigilationId: invigilation.id, ipAddress, userAgent,
      });
    }

    if (!isWithinWindow(invigilation)) {
      return this.recordAttempt({
        result: 'REJECTED_WINDOW', actor, invigilationId: invigilation.id, ipAddress, userAgent,
      });
    }

    const existing = await prisma.attendance.findFirst({
      where: { invigilationId: invigilation.id, userId: actor.id, result: 'RECORDED' },
    });
    if (existing) {
      return this.recordAttempt({
        result: 'REJECTED_DUPLICATE', actor, invigilationId: invigilation.id, ipAddress, userAgent,
      });
    }

    return this.recordAttempt({
      result: 'RECORDED', actor, invigilationId: invigilation.id, ipAddress, userAgent,
    });
  },

  async recordAttempt({ result, actor, invigilationId, ipAddress, userAgent }) {
    const attendance = await prisma.attendance.create({
      data: {
        invigilationId,
        userId: actor?.id,
        result,
        ipAddress,
        userAgent,
      },
    });
    return { result, attendance };
  },

  async list({ invigilationId } = {}, actor) {
    const where = {
      ...(invigilationId ? { invigilationId } : {}),
      ...(actor?.role === 'INVIGILATOR' ? { userId: actor.id } : {}),
    };
    return prisma.attendance.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true } },
        invigilation: {
          select: {
            id: true, scheduledAt: true,
            course: { select: { code: true, title: true } },
          },
        },
      },
    });
  },

  async generateVenueQrBatch(examinationSessionId, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only exam officers can generate venue QR codes.');
    }

    const session = await prisma.examinationSession.findUnique({
      where: { id: examinationSessionId },
      select: { id: true, name: true, endDate: true },
    });
    if (!session) throw ApiError.notFound('Examination session not found.');

    // All venues that have timetable entries in this session — single query.
    const venueGroups = await prisma.invigilation.groupBy({
      by: ['venueId'],
      where: { examinationSessionId, venueId: { not: null } },
    });
    const venueIds = venueGroups.map((g) => g.venueId);
    if (venueIds.length === 0) return { session, venues: [] };

    const venues = await prisma.venue.findMany({
      where: { id: { in: venueIds } },
      select: { id: true, name: true, location: true, capacity: true },
    });

    return {
      session,
      venues: venues.map((venue) => {
        const token = signVenueQrToken(venue.id, examinationSessionId);
        return {
          venueId: venue.id,
          venue,
          token,
          code: token,
        };
      }),
    };
  },

  async generateVenueQr(venueId, examinationSessionId, actor) {
    if (actor.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only exam officers can generate venue QR codes.');
    }

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true, location: true, capacity: true },
    });
    if (!venue) throw ApiError.notFound('Venue not found.');

    const session = await prisma.examinationSession.findUnique({
      where: { id: examinationSessionId },
      select: { id: true, name: true, endDate: true },
    });
    if (!session) throw ApiError.notFound('Examination session not found.');

    const entries = await prisma.invigilation.count({
      where: { examinationSessionId, venueId },
    });
    if (entries === 0) {
      throw ApiError.badRequest('No timetable entries for this venue in this session. Generate a timetable first.');
    }

    const token = signVenueQrToken(venueId, examinationSessionId);
    return {
      token,
      code: token,
      venue,
      session,
    };
  },

  /**
   * Validate a venue QR **without recording anything**.
   *
   * Lets the invigilator find out whether they are at the right venue before
   * committing to a check-in. `result` mirrors what `scanVenue` would return,
   * so the client can render the same messaging.
   */
  async previewVenueScan({ token }, actor) {
    const evaluation = await evaluateVenueScan(token, actor);
    const { result, venue, assignedVenue, allAssignedVenues, message, assignment, timeSlot } = evaluation;

    return {
      result,
      ok: result === 'RECORDED',
      venue: venue || null,
      assignedVenue: assignedVenue || null,
      allAssignedVenues: allAssignedVenues || null,
      slotAt: assignment?.slotAt || null,
      timeSlot: timeSlot || null,
      message: message || null,
    };
  },

  async scanVenue({ token, ipAddress, userAgent, latitude, longitude, locationAccuracy, address }, actor) {
    const evaluation = await evaluateVenueScan(token, actor);
    const { result, payload, venue, invigilator, assignedVenue, allAssignedVenues, message, timeSlot } = evaluation;

    // Check if location is within UENR campus (if coordinates provided)
    let isOnCampus = null;
    let locationWarning = null;
    if (latitude && longitude) {
      isOnCampus = isWithinUENRCampus(latitude, longitude);
      if (!isOnCampus) {
        locationWarning = 'Warning: Your location appears to be outside UENR campus.';
        console.warn(`[VenueScan] Off-campus scan detected: ${latitude}, ${longitude} by user ${actor.id}`);
      }
    }

    // An unreadable QR or unknown venue has no valid venue/session to attach a
    // scan row to, so nothing is persisted for those.
    if (result === 'REJECTED_INVALID_QR') {
      return { result, message: message || null };
    }
    if (result === 'REJECTED_UNASSIGNED' && !payload) {
      return { result, message: message || null };
    }

    // Record ALL scan attempts (successful and failed) for audit trail
    const scan = await prisma.venueScan.create({
      data: {
        venueId: payload.venueId,
        examinationSessionId: payload.examinationSessionId,
        userId: actor.id,
        result,
        ipAddress,
        userAgent,
        latitude: latitude || null,
        longitude: longitude || null,
        locationAccuracy: locationAccuracy || null,
        locationAddress: address || null,
      },
    });

    if (result !== 'RECORDED') {
      return {
        result,
        scan,
        venue: venue || null,
        assignedVenue: assignedVenue || null,
        allAssignedVenues: allAssignedVenues || null,
        message: message || null,
        locationWarning: locationWarning || null,
        isOnCampus,
      };
    }

    // Successful scan - notify exam officer
    const checkInTime = new Date(scan.scannedAt || Date.now()).toLocaleString();
    const locationStr = address
      ? ` (Location: ${address}${!isOnCampus ? ' - OFF CAMPUS' : ''})`
      : latitude != null && longitude != null
      ? ` (Approximate location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}${!isOnCampus ? ' - OFF CAMPUS' : ''} — exact address unavailable)`
      : '';
    
    // Notify with warning if off-campus
    const notificationTitle = isOnCampus === false 
      ? '⚠️ Invigilator checked in (OFF CAMPUS)' 
      : 'Invigilator checked in';
    
    notifyRole('SUPER_ADMIN', {
      type: 'INVIGILATOR_CHECKIN',
      title: notificationTitle,
      message: `${invigilator.fullName} checked in at ${venue.name} — ${checkInTime}${locationStr}.`,
      link: '/invigilator-assignments',
      data: { 
        venueId: payload.venueId, 
        examinationSessionId: payload.examinationSessionId, 
        scanId: scan.id, 
        latitude, 
        longitude,
        isOnCampus,
      },
    }).catch(() => {});

    broadcast.toRoles('SUPER_ADMIN', 'invigilator-checkin', {
      scanId: scan.id,
      scannedAt: scan.scannedAt,
      venue: { id: venue.id, name: venue.name, location: venue.location },
      invigilator: {
        id: invigilator.id,
        fullName: invigilator.fullName,
        email: invigilator.email,
        staffId: invigilator.staffId,
      },
      examinationSessionId: payload.examinationSessionId,
      latitude: latitude || null,
      longitude: longitude || null,
      address: address || null,
      isOnCampus,
      timeSlot: timeSlot || null,
    });

    return {
      result: 'RECORDED',
      scan,
      venue,
      timeSlot: timeSlot || null,
      invigilator: { fullName: invigilator.fullName, email: invigilator.email, staffId: invigilator.staffId },
      locationWarning: locationWarning || null,
      isOnCampus,
    };
  },

  async listVenueScans({ examinationSessionId, venueId, date } = {}, actor) {
    const where = {
      ...(examinationSessionId ? { examinationSessionId } : {}),
      ...(venueId ? { venueId } : {}),
      ...(actor?.role === 'INVIGILATOR' ? { userId: actor.id } : {}),
    };

    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      where.scannedAt = { gte: dayStart, lt: dayEnd };
    }

    return prisma.venueScan.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true, staffId: true } },
        venue: { select: { id: true, name: true, location: true } },
      },
    });
  },
};
