/** Wraps async controllers so thrown errors flow to the errorHandler middleware. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
