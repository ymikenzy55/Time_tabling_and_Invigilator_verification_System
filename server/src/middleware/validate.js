import { ApiError } from '../utils/ApiError.js';

/**
 * Validates req[source] against a Zod schema. Replaces req[source] with parsed data.
 *   router.post('/x', validate(schema, 'body'), handler)
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(
      ApiError.badRequest('Please review the highlighted fields.', result.error.flatten())
    );
  }
  req[source] = result.data;
  next();
};
