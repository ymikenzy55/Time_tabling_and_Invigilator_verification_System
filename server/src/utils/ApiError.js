/**
 * Domain error class. Anything thrown as ApiError is considered "expected"
 * and safe to surface to clients. Everything else is treated as an internal
 * error and generalized by the errorHandler middleware.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message = 'Invalid request', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'You must be signed in to perform this action.') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'The requested resource was not found.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message = 'This action conflicts with the current state.') {
    return new ApiError(409, 'CONFLICT', message);
  }
  static tooMany(message = 'Too many requests. Please try again later.') {
    return new ApiError(429, 'RATE_LIMITED', message);
  }
  static internal(message = 'Something went wrong. Please try again later.') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}
