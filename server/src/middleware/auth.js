import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';

// Short-lived cache of authenticated users to avoid one DB round-trip per
// request. Entries expire quickly so role/status changes still apply fast.
const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map(); // userId -> { user, expiresAt }

const getCachedUser = (userId) => {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    userCache.delete(userId);
    return null;
  }
  return entry.user;
};

/** Drop a user from the auth cache (call after role/status/department changes). */
export const invalidateAuthCache = (userId) => {
  if (userId) userCache.delete(userId);
  else userCache.clear();
};

/**
 * Attaches req.user if a valid Bearer token is present.
 * Rejects unauthenticated requests.
 */
export const requireAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, headerToken] = header.split(' ');
    const token = (scheme === 'Bearer' ? headerToken : null) || req.query.token;
    if (!token) {
      throw ApiError.unauthorized('You must be signed in to perform this action.');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Your session has expired. Please sign in again.');
    }

    let user = getCachedUser(payload.sub);

    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          departmentId: true,
          departmentName: true,
          isDemo: true,
        },
      });
      if (user) {
        userCache.set(user.id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
      }
    }

    if (!user) throw ApiError.unauthorized('Your account could not be found.');
    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Your account is not active. Please contact the administrator.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
