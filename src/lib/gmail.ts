/**
 * Gmail ingestion (spec §4). Read-only. Scope: gmail.readonly and nothing wider.
 *
 * Vercel has no persistent disk, so the OAuth token lives in the DB (GmailToken)
 * rather than token.json. The refresh token is the sensitive value.
 *
 * Ingestion rule (§4.3): insert into raw_emails with parse_status='pending';
 * do NOT parse inline; dedupe on gmail_message_id; never delete.
 */
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { prisma } from './db';
import { allSenders } from '@/config/banks';
import { getConfig } from './config';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export async function oauthClient(): Promise<OAuth2Client> {
  const cfg = await getConfig();
  if (!cfg.googleClientId || !cfg.googleClientSecret || !cfg.googleRedirectUri) {
    throw new Error('Google OAuth credentials missing — set them in Settings (or GOOGLE_CLIENT_ID / _SECRET / _REDIRECT_URI)');
  }
  return new google.auth.OAuth2(cfg.googleClientId, cfg.googleClientSecret, cfg.googleRedirectUri);
}

export async function authUrl(userId: number): Promise<string> {
  const client = await oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline', // request a refresh token
    prompt: 'consent', // force refresh_token issuance on re-consent
    scope: SCOPES,
    state: String(userId), // so the callback knows which user is connecting
  });
}

/** Exchange an auth code for tokens and persist them for this user. */
export async function exchangeCode(code: string, userId: number): Promise<void> {
  const client = await oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let emailAddress: string | null = null;
  try {
    const gmail = google.gmail({ version: 'v1', auth: client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    emailAddress = profile.data.emailAddress ?? null;
  } catch {
    // non-fatal
  }

  await prisma.gmailToken.upsert({
    where: { userId },
    update: {
      accessToken: tokens.access_token ?? undefined,
      refreshToken: tokens.refresh_token ?? undefined, // only sent on first consent
      expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : undefined,
      scope: tokens.scope ?? undefined,
      tokenType: tokens.token_type ?? undefined,
      emailAddress: emailAddress ?? undefined,
    },
    create: {
      userId,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      emailAddress,
    },
  });
}

/**
 * Raised when Google refuses the stored refresh token (`invalid_grant`). Causes:
 * the OAuth consent screen is still in "Testing" (Google expires those refresh
 * tokens after 7 days), the user revoked access, the token was issued by a
 * different client_id than the one now configured, or the password changed.
 * The only cure is re-consent, so we drop the dead token to bring the
 * "Connect Gmail" banner back.
 */
export class GmailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GmailAuthError';
  }
}

function isInvalidGrant(err: unknown): boolean {
  const e = err as any;
  return e?.response?.data?.error === 'invalid_grant' || String(e?.message ?? e).includes('invalid_grant');
}

/** Drop the dead token and surface an actionable message. */
async function onInvalidGrant(userId: number): Promise<never> {
  await prisma.gmailToken
    .update({ where: { userId }, data: { accessToken: null, refreshToken: null, expiryDate: null } })
    .catch(() => undefined);
  throw new GmailAuthError('Gmail authorization expired or was revoked — reconnect Gmail in Settings.');
}

/** Build an authorized client from the user's stored token, persisting refreshes. */
async function authorizedClient(userId: number): Promise<OAuth2Client> {
  const stored = await prisma.gmailToken.findUnique({ where: { userId } });
  if (!stored?.refreshToken) {
    throw new GmailAuthError('Gmail isn’t connected yet. Connect it in Settings to fetch new transactions.');
  }
  const client = await oauthClient();
  client.setCredentials({
    access_token: stored.accessToken ?? undefined,
    refresh_token: stored.refreshToken,
    expiry_date: stored.expiryDate ? Number(stored.expiryDate) : undefined,
    scope: stored.scope ?? undefined,
    token_type: stored.tokenType ?? undefined,
  });

  // Persist rotated access/refresh tokens.
  client.on('tokens', (tokens) => {
    // Fire-and-forget: an unhandled rejection here would kill the request.
    void prisma.gmailToken
      .update({
        where: { userId },
        data: {
          accessToken: tokens.access_token ?? undefined,
          refreshToken: tokens.refresh_token ?? undefined,
          expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : undefined,
        },
      })
      .catch((e) => console.error('[gmail] failed to persist refreshed token:', e));
  });

  return client;
}

export async function isConnected(userId: number): Promise<{ connected: boolean; email: string | null }> {
  const stored = await prisma.gmailToken.findUnique({ where: { userId } });
  return { connected: Boolean(stored?.refreshToken), email: stored?.emailAddress ?? null };
}

// Decode a base64url Gmail body part.
function decodeBody(data?: string | null): string {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

interface ExtractedBodies {
  text: string;
  html: string | null;
}

// Walk the MIME tree collecting text/plain and text/html parts.
function extractBodies(payload: any): ExtractedBodies {
  // Accumulator object avoids closure-assignment narrowing on locals.
  const acc: { text: string; html: string | null } = { text: '', html: null };

  const walk = (part: any) => {
    if (!part) return;
    const mime = part.mimeType || '';
    if (mime === 'text/plain' && part.body?.data) acc.text += decodeBody(part.body.data);
    else if (mime === 'text/html' && part.body?.data) acc.html = (acc.html ?? '') + decodeBody(part.body.data);
    if (Array.isArray(part.parts)) part.parts.forEach(walk);
  };
  walk(payload);

  let { text, html } = acc;

  // If only HTML present, derive a rough plaintext for parsing.
  if (!text && html) {
    text = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  return { text, html };
}

function header(headers: any[], name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

export interface SyncResult {
  fetched: number;
  inserted: number;
  skipped: number; // already present (dedupe on gmail_message_id)
  /** False when the deadline stopped the run early; calling again resumes. */
  done: boolean;
}

export interface SyncOptions {
  /** Only this calendar month ("YYYY-MM"). Otherwise the last `days` days. */
  month?: string;
  days?: number;
  /** Epoch ms. Stop starting new downloads after this; what's stored stays stored. */
  deadline?: number;
}

/** Messages downloaded at once. Gmail's per-user quota is far above this. */
const CONCURRENCY = 8;

/** Gmail search terms for a "YYYY-MM" month: after the 1st, before the next 1st. */
export function monthQuery(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `after:${y}/${pad(m)}/01 before:${next[0]}/${pad(next[1])}/01`;
}

/**
 * Fetch bank alert emails and store them into raw_emails (§4.3).
 * Bounded by `month` or `days`; dedupes on gmail_message_id. With a
 * `deadline` it stops early and returns done=false — every stored email is
 * skipped next time, so repeated calls finish the job.
 */
export async function syncGmail(userId: number, opts: SyncOptions = {}): Promise<SyncResult> {
  try {
    return await syncGmailInner(userId, opts);
  } catch (err) {
    if (isInvalidGrant(err)) await onInvalidGrant(userId);
    throw err;
  }
}

async function syncGmailInner(userId: number, { month, days = Number(process.env.BACKFILL_DAYS || 30), deadline = Infinity }: SyncOptions): Promise<SyncResult> {
  const client = await authorizedClient(userId);
  const gmail = google.gmail({ version: 'v1', auth: client });

  // Built-in bank senders + this user's own custom ones.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { customSenders: true, disabledSenders: true } });
  const custom = (user?.customSenders ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const disabled = new Set((user?.disabledSenders ?? []).map((s) => s.trim().toLowerCase()));
  const senders = Array.from(new Set([...allSenders(), ...custom])).filter((s) => !disabled.has(s));
  const fromClause = senders.map((s) => `from:${s}`).join(' OR ');
  const query = `(${fromClause}) ${month ? monthQuery(month) : `newer_than:${days}d`}`;

  const res: SyncResult = { fetched: 0, inserted: 0, skipped: 0, done: true };
  let pageToken: string | undefined;
  const seen = new Set<string>(); // guard against Gmail returning an id twice in one run

  do {
    const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100, pageToken });
    const ids: string[] = [];
    for (const msg of list.data.messages ?? []) {
      if (!msg.id) continue;
      res.fetched++;
      if (seen.has(msg.id)) res.skipped++;
      else ids.push(msg.id);
      seen.add(msg.id);
    }

    // Dedupe before fetching the full message (§4.3 idempotency guarantee) —
    // one query per page rather than one per message.
    const stored = new Set(
      (await prisma.rawEmail.findMany({ where: { userId, gmailMessageId: { in: ids } }, select: { gmailMessageId: true } })).map((r) => r.gmailMessageId),
    );
    const missing = ids.filter((id) => !stored.has(id));
    res.skipped += ids.length - missing.length;

    // A few downloads at a time: one by one, a first sync of a busy inbox
    // outlasts the 60s serverless limit before it stores anything useful.
    let next = 0;
    const worker = async () => {
      while (next < missing.length && Date.now() < deadline) {
        const id = missing[next++];
        if (await storeMessage(gmail, userId, id)) res.inserted++;
        else res.skipped++;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (next < missing.length) {
      res.done = false;
      return res;
    }

    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken);

  await prisma.syncState.upsert({
    where: { userId },
    update: { lastSyncAt: new Date(), lastSyncStatus: `inserted ${res.inserted}, skipped ${res.skipped}` },
    create: { userId, lastSyncAt: new Date(), lastSyncStatus: `inserted ${res.inserted}` },
  });

  return res;
}

/** Download one message into raw_emails. False if it was already stored. */
async function storeMessage(gmail: ReturnType<typeof google.gmail>, userId: number, id: string): Promise<boolean> {
  const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
  const payload = full.data.payload;
  const headers = payload?.headers ?? [];
  const { text, html } = extractBodies(payload);
  const internalDate = full.data.internalDate ? new Date(Number(full.data.internalDate)) : new Date();

  try {
    await prisma.rawEmail.create({
      data: {
        userId,
        gmailMessageId: id,
        gmailThreadId: full.data.threadId ?? null,
        sender: header(headers, 'From'),
        subject: header(headers, 'Subject'),
        bodyText: text,
        bodyHtml: html,
        receivedAt: internalDate,
        parseStatus: 'pending',
      },
    });
    return true;
  } catch (err: any) {
    // Unique-constraint race on gmail_message_id → already stored; skip, don't crash.
    if (err?.code === 'P2002') return false;
    throw err;
  }
}
