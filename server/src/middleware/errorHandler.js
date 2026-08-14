import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';
import { isProd } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Known operational errors
  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.statusCode, err.code, err.message, err.details);
  }

  // Zod validation errors that bubble up
  if (err instanceof ZodError) {
    return ApiResponse.error(res, 400, 'VALIDATION_ERROR', 'Please review the highlighted fields.', err.flatten());
  }

  // Prisma known errors — do not leak internals
  if (err?.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    logger.warn('Prisma error', { code: err.code, message: err.message });
    if (err.code === 'P2002') {
      return ApiResponse.error(res, 409, 'CONFLICT', 'A record with these values already exists.');
    }
    if (err.code === 'P2025') {
      return ApiResponse.error(res, 404, 'NOT_FOUND', 'The requested record was not found.');
    }
    return ApiResponse.error(res, 400, 'DATABASE_ERROR', 'The request could not be completed.');
  }

  // Fallback — never expose stack in production
  logger.error('Unhandled error', { message: err?.message, stack: err?.stack });
  return ApiResponse.error(
    res,
    500,
    'INTERNAL_ERROR',
    'Something went wrong on our end. Please try again shortly.',
    isProd ? undefined : { message: err?.message }
  );
};
