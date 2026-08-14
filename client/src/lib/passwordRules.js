import { z } from 'zod';

/**
 * Password rules — used for BOTH live UX hints and the Zod validator.
 * Keep this in sync with server/src/utils/passwordPolicy.js
 */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters',           test: (v) => v.length >= 8 },
  { id: 'upper',  label: 'One uppercase letter (A–Z)',      test: (v) => /[A-Z]/.test(v) },
  { id: 'lower',  label: 'One lowercase letter (a–z)',      test: (v) => /[a-z]/.test(v) },
  { id: 'digit',  label: 'One number (0–9)',                test: (v) => /\d/.test(v) },
  { id: 'symbol', label: 'One symbol (e.g. ! @ # $ % & *)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export const evaluatePassword = (value = '') =>
  PASSWORD_RULES.map((r) => ({ ...r, met: r.test(value) }));

export const isStrongPassword = (value = '') =>
  PASSWORD_RULES.every((r) => r.test(value));

/** Zod refinement for a strong password. */
export const strongPassword = () =>
  z.string()
    .min(8, 'At least 8 characters.')
    .refine((v) => /[A-Z]/.test(v), 'Must include an uppercase letter.')
    .refine((v) => /[a-z]/.test(v), 'Must include a lowercase letter.')
    .refine((v) => /\d/.test(v),    'Must include a number.')
    .refine((v) => /[^A-Za-z0-9]/.test(v), 'Must include a symbol.');
