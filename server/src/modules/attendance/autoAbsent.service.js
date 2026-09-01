import { prisma } from '../../utils/prisma.js';
import { notifyRole } from '../notifications/notifications.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Periodically checks for venue assignments whose exam window has passed
 * without a successful scan. For each missed assignment, creates an ABSENT
 * VenueScan record and notifies all SUPER_ADMIN users (exam officers).
 *
 * Runs every 5 minutes. Only processes assignments from the last 24 hours
 * to avoid reprocessing old data.
 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LOOKBACK_HOURS = 24;
const EXAM_DURATION_DEFAULT_MIN = 180;

let intervalId = null;

const processMissedScans = async () => {
  try {
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

    // Find assignments whose slot time + duration has passed (exam is over)
    // but haven't been processed yet. Skip demo invigilators — they scan on
    // their own schedule for demonstration purposes.
    const assignments = await prisma.venueAssignment.findMany({
      where: {
        slotAt: { gte: lookbackStart, lt: now },
        invigilator: { isDemo: false },
      },
      select: {
        id: true,
        examinationSessionId: true,
        venueId: true,
        invigilatorId: true,
        slotAt: true,
        venue: { select: { id: true, name: true } },
        invigilator: { select: { id: true, fullName: true, staffId: true, isDemo: true } },
      },
    });

    let absentCount = 0;

    for (const assignment of assignments) {
      // Check if a RECORDED scan already exists for this assignment
      const existingScan = await prisma.venueScan.findFirst({
        where: {
          venueId: assignment.venueId,
          examinationSessionId: assignment.examinationSessionId,
          userId: assignment.invigilatorId,
          result: 'RECORDED',
          scannedAt: {
            gte: new Date(assignment.slotAt),
            lt: new Date(assignment.slotAt.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existingScan) continue;

      // Check if an ABSENT scan was already created (avoid duplicates)
      const existingAbsent = await prisma.venueScan.findFirst({
        where: {
          venueId: assignment.venueId,
          examinationSessionId: assignment.examinationSessionId,
          userId: assignment.invigilatorId,
          result: 'ABSENT',
        },
      });

      if (existingAbsent) continue;

      // Create ABSENT scan record
      await prisma.venueScan.create({
        data: {
          venueId: assignment.venueId,
          examinationSessionId: assignment.examinationSessionId,
          userId: assignment.invigilatorId,
          result: 'ABSENT',
          scannedAt: now,
        },
      });

      absentCount++;

      // Notify exam officers
      const slotTime = new Date(assignment.slotAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const dateStr = new Date(assignment.slotAt).toLocaleDateString();

      notifyRole('SUPER_ADMIN', {
        type: 'INVIGILATOR_ABSENT',
        title: 'Invigilator absent — missed scan',
        message: `${assignment.invigilator.fullName} (${assignment.invigilator.staffId || 'No Staff ID'}) did not scan in for their duty at ${assignment.venue.name} on ${dateStr} at ${slotTime}. They have been marked absent.`,
        link: '/invigilator-assignments',
        data: {
          venueAssignmentId: assignment.id,
          venueId: assignment.venueId,
          invigilatorId: assignment.invigilatorId,
        },
      }).catch(() => {});
    }

    if (absentCount > 0) {
      logger.info(`[autoAbsent] Marked ${absentCount} invigilator(s) as absent.`);
    }
  } catch (err) {
    logger.error('[autoAbsent] Error processing missed scans', { message: err.message });
  }
};

export const startAutoAbsentChecker = () => {
  if (intervalId) return;
  // Run an initial check after 30 seconds (let server finish booting)
  setTimeout(processMissedScans, 30_000);
  intervalId = setInterval(processMissedScans, CHECK_INTERVAL_MS);
  logger.info(`[autoAbsent] Checker started — runs every ${CHECK_INTERVAL_MS / 1000}s`);
};

export const stopAutoAbsentChecker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
