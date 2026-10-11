/**
 * Session handling (edge-safe: used by middleware and API routes).
 * A session cookie is `${userId}.${hmac(userId)}`, signed with SESSION_SECRET
 * via Web Crypto so it works in both the Edge and Node runtimes.
 */
export const SESSION_COOKIE = 'mt_session';

async function hmac(message: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || 'insecure-default-secret-change-me';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Cookie value for a signed-in user. */
export async function createSession(userId: number): Promise<string> {
  return `${userId}.${await hmac(String(userId))}`;
}

/** Verify a session cookie and return the userId, or null. */
export async function verifySession(value: string | undefined | null): Promise<number | null> {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (sig !== (await hmac(id))) return null;
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

/**
 * Per-user token for the SMS ingest webhook.
 *
 * Derived from SESSION_SECRET rather than stored, so adding SMS needs no
 * schema change (the ingest path must keep working on an unmigrated
 * database). The prefix keeps the namespace disjoint from session cookies:
 * an ingest token can never be replayed as a session, or vice versa.
 * Rotating SESSION_SECRET invalidates every ingest token along with every
 * session, which is the intended revocation path.
 */
export async function createIngestToken(userId: number): Promise<string> {
  return `${userId}.${await hmac(`sms-ingest:${userId}`)}`;
}

/** Verify an ingest token and return the userId, or null. */
export async function verifyIngestToken(value: string | undefined | null): Promise<number | null> {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  const expected = await hmac(`sms-ingest:${n}`);
  const got = value.slice(dot + 1);
  // Constant-time: this token is guessed against over the network, unlike a
  // session cookie the caller already holds.
  if (got.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? n : null;
}
