'use client';

/**
 * The app's one sync loop. It lives at module level, not in a component, so it
 * keeps running when you move to another page (the app shell never reloads),
 * and every component reads its progress from here: the Sync button, AutoSync
 * and the floating status pill (SyncStatus).
 *
 * The server does a bounded slice of work per /api/sync call and answers
 * `more: true` until it's finished, so this calls it in a loop. Only one loop
 * runs per tab; the server's lock (lib/syncLock.ts) covers other tabs.
 */
interface SyncResponse {
  ok: boolean;
  more?: boolean;
  busy?: boolean;
  message?: string;
  error?: string | null;
  sync?: { inserted: number; skipped: number; fetched: number; done: boolean } | null;
  parse?: { parsed: number; merged: number } | null;
  categorize?: { byRule: number; byLlm: number } | null;
}

export interface SyncState {
  running: boolean;
  /** "YYYY-MM" being synced, or null for the default recent window. */
  month: string | null;
  emails: number;
  transactions: number;
  /** Last finished run, for the toast. Cleared when a new run starts. */
  result: { ok: boolean; text: string } | null;
  /** Bumps when a run finishes, so pages know to reload their data. */
  finishedAt: number;
}

/** Hard stop for a loop that somehow never reports done (~25 min of calls). */
const MAX_ROUNDS = 30;
/** A timed-out call has still stored what it fetched, so just call again. */
const MAX_RETRIES = 3;

let state: SyncState = { running: false, month: null, emails: 0, transactions: 0, result: null, finishedAt: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeSync(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getSyncState = () => state;

export function clearSyncResult() {
  set({ result: null });
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthName(month: string | null): string {
  if (!month) return 'recent emails';
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

async function call(month: string | null): Promise<SyncResponse & { status: number }> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(month ? { month } : {}),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, error: 'Couldn’t reach SpendWise. Check your connection and try again.' };
  // A crash or timeout on the host returns a plain-text error page, not JSON.
  const data = (await res.json().catch(() => null)) as SyncResponse | null;
  return data ? { ...data, status: res.status } : { ok: false, status: res.status, error: `Sync failed on the server (${res.status}).` };
}

let inFlight: Promise<SyncState['result']> | null = null;

/** Sync `month` ("YYYY-MM"), or recent mail if omitted. Joins a run already in progress. */
export function runSync(month?: string | null): Promise<SyncState['result']> {
  if (inFlight) return inFlight;
  inFlight = loop(month ?? null).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function loop(month: string | null): Promise<SyncState['result']> {
  set({ running: true, month, emails: 0, transactions: 0, result: null });
  let emails = 0;
  let transactions = 0;
  let gmailError: string | null = null;
  let result: SyncState['result'] = null;

  for (let round = 0, retries = 0; round < MAX_ROUNDS; round++) {
    const data = await call(month);

    if (data.busy) {
      result = { ok: true, text: data.message || 'A sync is already running…' };
      break;
    }
    // Network blip or the host cutting a call short: everything stored so far
    // stays stored, so the next call carries on from there.
    if (!data.ok && data.more === undefined) {
      if (retries++ < MAX_RETRIES && (data.status === 0 || data.status >= 500)) continue;
      result = { ok: false, text: data.error || 'Sync failed' };
      break;
    }

    emails += data.sync?.inserted ?? 0;
    transactions += data.parse?.parsed ?? 0;
    if (data.error) gmailError = data.error;
    set({ emails, transactions });

    if (!data.more) {
      result = gmailError
        ? { ok: false, text: gmailError }
        : {
            ok: true,
            text: transactions
              ? `Synced ${monthName(month)}: ${transactions} new transaction${transactions === 1 ? '' : 's'} from ${emails} email${emails === 1 ? '' : 's'}`
              : `Synced ${monthName(month)}: you’re up to date`,
          };
      break;
    }
  }

  result ??= { ok: false, text: 'Sync is taking unusually long — it stopped, but kept what it fetched. Try again to carry on.' };
  set({ running: false, result, finishedAt: Date.now() });
  // Let open pages refresh their data.
  window.dispatchEvent(new CustomEvent('mt:synced'));
  return result;
}
