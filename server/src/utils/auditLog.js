import { prisma } from './prisma.js';

/**
 * Fire-and-forget audit log — never blocks the response or breaks the request.
 * Every service that previously did `await prisma.auditLog.create(...)` should
 * call this instead to avoid an extra DB round-trip on the critical path.
 */
export const logAudit = (data) => {
  prisma.auditLog.create({ data }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log:', err.message);
  });
};

/**
 * Batch fire-and-forget audit log — writes multiple entries in a single
 * createMany query instead of N individual create calls. Use this in loops
 * to avoid exhausting the connection pool with dozens of simultaneous inserts.
 */
export const logAuditBatch = (entries) => {
  if (!entries.length) return;
  prisma.auditLog.createMany({ data: entries }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to write audit log batch:', err.message);
  });
};
