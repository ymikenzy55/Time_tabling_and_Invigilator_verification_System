import { ApiError } from '../utils/ApiError.js';

/**
 * Role-Based Access Control. Use AFTER requireAuth.
 *   router.get('/x', requireAuth, requireRole('SUPER_ADMIN'), handler)
 */
export const requireRole = (...allowed) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!allowed.includes(req.user.role)) {
    return next(ApiError.forbidden('You do not have permission to perform this action.'));
  }
  next();
};
