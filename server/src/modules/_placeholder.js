import { Router } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Factory for phase-not-yet-built module routers.
 * Returns a router that responds 501 to every route so the API surface
 * is discoverable while implementation is pending.
 */
export const placeholderRouter = (moduleName) => {
  const router = Router();
  router.all('*', (_req, res) =>
    ApiResponse.error(
      res,
      501,
      'NOT_IMPLEMENTED',
      `The ${moduleName} module is not yet available in this phase.`
    )
  );
  return router;
};
