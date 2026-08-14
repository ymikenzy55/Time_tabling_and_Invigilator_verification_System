/**
 * Consistent response envelope for every API endpoint.
 *   Success:  { success: true,  data, meta? }
 *   Failure:  { success: false, error: { code, message, details? } }
 */
export const ApiResponse = {
  ok(res, data, meta) {
    return res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });
  },
  created(res, data, meta) {
    return res.status(201).json({ success: true, data, ...(meta ? { meta } : {}) });
  },
  noContent(res) {
    return res.status(204).end();
  },
  error(res, statusCode, code, message, details) {
    return res.status(statusCode).json({
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    });
  },
};
