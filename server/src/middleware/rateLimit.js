import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/ApiResponse.js';

const handler = (_req, res) =>
  ApiResponse.error(res, 429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.');

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
