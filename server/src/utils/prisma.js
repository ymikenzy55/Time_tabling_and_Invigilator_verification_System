import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

// Reuse a single client across the process (avoids exhausting connections in dev with nodemon).
const globalForPrisma = globalThis;

// Increase connection pool size and timeout to prevent pool exhaustion.
const dbUrl = process.env.DATABASE_URL || '';
const poolParams = 'connection_limit=20&pool_timeout=30';
const enhancedUrl = dbUrl.includes('connection_limit')
  ? dbUrl
  : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}${poolParams}`;

export const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: isProd ? ['error'] : ['warn', 'error'],
    datasources: { db: { url: enhancedUrl } },
  });

if (!isProd) globalForPrisma.__prisma = prisma;

// Pre-warm the connection pool so the first request doesn't pay cold-start latency.
prisma.$connect().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to pre-warm database connection:', err.message);
});
