import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure URL-safe token.
 * The raw token is returned to the caller ONCE — it must never be persisted.
 * Only the SHA-256 hash is stored in the database.
 */
export const generateToken = (bytes = 32) => {
  const raw = crypto.randomBytes(bytes).toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
};

export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');
