import { ApiResponse } from '../utils/ApiResponse.js';

export const notFound = (req, res) =>
  ApiResponse.error(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} was not found.`);
