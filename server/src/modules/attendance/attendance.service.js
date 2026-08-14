import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';
import { createNotification } from '../notifications/notifications.service.js';

const QR_SECRET = env.QR_SIGNING_SECRET || env.JWT_SECRET;
const QR_TOKEN_EXPIRY = '8h';
const VENUE_QR_EXPIRY = '24h';

export const signQrToken = (invigilationId) =>
  jwt.sign({ invigilationId, type: 'QR_ATTENDANCE' }, QR_SECRET, { expiresIn: QR_TOKEN_EXPIRY });

export const signVenueQrToken = (venueId, examinationSessionId) =>
  jwt.sign({ venueId, examinationSessionId, type: 'VENUE_QR' }, QR_SECRET, { expiresIn: VENUE_QR_EXPIRY });

export const verifyQrToken = (token) => {
  try {
    return jwt.verify(token, QR_SECRET);
  } catch {
    return null;
  }
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
      link: `${env.CLIENT_ORIGIN}/scan?token=${encodeURIComponent(token)}`,
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
      select: { id: true, name: true },
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
          link: `${env.CLIENT_ORIGIN}/scan?token=${encodeURIComponent(token)}`,
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
      select: { id: true, name: true },
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
      link: `${env.CLIENT_ORIGIN}/scan?token=${encodeURIComponent(token)}`,
      venue,
      session,
    };
  },

  async scanVenue({ token, ipAddress, userAgent }, actor) {
    const payload = verifyQrToken(token);
    if (!payload || payload.type !== 'VENUE_QR' || !payload.venueId || !payload.examinationSessionId) {
      return { result: 'REJECTED_INVALID_QR' };
    }

    if (actor.role !== 'INVIGILATOR') {
      return { result: 'REJECTED_UNASSIGNED' };
    }

    const invigilator = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, role: true, status: true, fullName: true, email: true, staffId: true },
    });

    if (!invigilator || invigilator.role !== 'INVIGILATOR' || invigilator.status !== 'ACTIVE') {
      const scan = await prisma.venueScan.create({
        data: {
          venueId: payload.venueId,
          examinationSessionId: payload.examinationSessionId,
          userId: actor.id,
          result: 'REJECTED_UNASSIGNED',
          ipAddress,
          userAgent,
        },
      });
      return { result: 'REJECTED_UNASSIGNED', scan };
    }

    const venue = await prisma.venue.findUnique({
      where: { id: payload.venueId },
      select: { id: true, name: true, location: true },
    });
    if (!venue) {
      return { result: 'REJECTED_INVALID_QR' };
    }

    // Verify the invigilator is assigned to this venue for this session
    const assignment = await prisma.venueAssignment.findFirst({
      where: {
        invigilatorId: actor.id,
        venueId: payload.venueId,
        examinationSessionId: payload.examinationSessionId,
      },
    });
    if (!assignment) {
      const scan = await prisma.venueScan.create({
        data: {
          venueId: payload.venueId,
          examinationSessionId: payload.examinationSessionId,
          userId: actor.id,
          result: 'REJECTED_VENUE_MISMATCH',
          ipAddress,
          userAgent,
        },
      });
      return {
        result: 'REJECTED_VENUE_MISMATCH',
        scan,
        venue,
        message: `You are not assigned to ${venue.name}. You can only scan QR codes for venues you are assigned to.`,
      };
    }

    const existing = await prisma.venueScan.findFirst({
      where: {
        venueId: payload.venueId,
        examinationSessionId: payload.examinationSessionId,
        userId: actor.id,
        result: 'RECORDED',
      },
    });
    if (existing) {
      const scan = await prisma.venueScan.create({
        data: {
          venueId: payload.venueId,
          examinationSessionId: payload.examinationSessionId,
          userId: actor.id,
          result: 'REJECTED_DUPLICATE',
          ipAddress,
          userAgent,
        },
      });
      return { result: 'REJECTED_DUPLICATE', scan };
    }

    const scan = await prisma.venueScan.create({
      data: {
        venueId: payload.venueId,
        examinationSessionId: payload.examinationSessionId,
        userId: actor.id,
        result: 'RECORDED',
        ipAddress,
        userAgent,
      },
    });

    // Notify all exam officers about the check-in
    const examOfficers = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    const checkInTime = new Date().toLocaleString();
    await Promise.all(
      examOfficers.map((officer) =>
        createNotification({
          userId: officer.id,
          type: 'INVIGILATOR_CHECKIN',
          title: 'Invigilator checked in',
          message: `${invigilator.fullName} checked in at ${venue.name} — ${checkInTime}.`,
          link: '/invigilator-assignments',
          data: { venueId: payload.venueId, examinationSessionId: payload.examinationSessionId, scanId: scan.id },
        }).catch(() => {})
      )
    );

    return {
      result: 'RECORDED',
      scan,
      venue,
      invigilator: { fullName: invigilator.fullName, email: invigilator.email, staffId: invigilator.staffId },
    };
  },

  async listVenueScans({ examinationSessionId, venueId } = {}, actor) {
    const where = {
      ...(examinationSessionId ? { examinationSessionId } : {}),
      ...(venueId ? { venueId } : {}),
      ...(actor?.role === 'INVIGILATOR' ? { userId: actor.id } : {}),
    };
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
