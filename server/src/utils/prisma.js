import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

// Reuse a single client across the process (avoids exhausting connections in dev with nodemon).
const globalForPrisma = globalThis;

// Build the optimal connection URL based on the database provider.
// Neon pooled endpoints (containing "-pooler") require pgbouncer=true and
// a low connection_limit to avoid "Connection closed" errors.
const dbUrl = process.env.DATABASE_URL || '';
const isNeonPooled = dbUrl.includes('-pooler');
const isNeonDirect = dbUrl.includes('neon.tech') && !isNeonPooled;

const poolParams = isNeonPooled
  ? 'pgbouncer=true&connection_limit=1&pool_timeout=30'
  : isNeonDirect
  ? 'connection_limit=5&pool_timeout=30'
  : 'connection_limit=20&pool_timeout=30';

const enhancedUrl = dbUrl.includes('connection_limit') || dbUrl.includes('pgbouncer')
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
// Don't crash the server if the DB is temporarily unavailable — it will retry on demand.
prisma.$connect().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to pre-warm database connection:', err.message);
});
