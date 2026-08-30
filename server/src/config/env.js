import 'dotenv/config';
import { z } from 'zod';

const splitOrigins = (value) =>
  String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const isHttpUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),

  // One origin, or several separated by commas (e.g. the Render URL plus a
  // custom domain). Every entry must be a full URL including the scheme.
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .refine(
      (value) => splitOrigins(value).length > 0 && splitOrigins(value).every(isHttpUrl),
      'CLIENT_ORIGIN must be a comma-separated list of absolute URLs (e.g. https://app.example.com)'
    ),


  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  SUPER_ADMIN_NAME: z.string().optional(),
  SUPER_ADMIN_STAFF_ID: z.string().optional(),

  QR_SIGNING_SECRET: z.string().min(16).optional(),

  // Brevo (Sendinblue) API for emails
  BREVO_API_KEY: z.string().optional(),
  
  // Legacy SMTP fallback
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

/** Allowed browser origins for CORS (HTTP and Socket.IO). */
export const clientOrigins = splitOrigins(env.CLIENT_ORIGIN);

/**
 * Canonical public URL of the frontend — the first entry in CLIENT_ORIGIN.
 * Use this (never env.CLIENT_ORIGIN) when building links for QR codes and
 * emails, since CLIENT_ORIGIN may contain several comma-separated origins.
 */
export const primaryClientOrigin = clientOrigins[0];
