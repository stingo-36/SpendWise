import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

/** Hash a password with scrypt. Stored as `saltHex:hashHex`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** Verify a password against a stored `saltHex:hashHex`. Constant-time. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
