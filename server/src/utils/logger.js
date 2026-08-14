/** Minimal structured logger. Replace with pino/winston later if needed. */
import { isProd } from '../config/env.js';

const format = (level, msg, meta) => {
  const record = { time: new Date().toISOString(), level, msg, ...(meta || {}) };
  return isProd ? JSON.stringify(record) : `[${record.time}] ${level.toUpperCase()} ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
};

export const logger = {
  info: (msg, meta) => console.log(format('info', msg, meta)),
  warn: (msg, meta) => console.warn(format('warn', msg, meta)),
  error: (msg, meta) => console.error(format('error', msg, meta)),
  debug: (msg, meta) => {
    if (!isProd) console.log(format('debug', msg, meta));
  },
};
