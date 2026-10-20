'use client';

/**
 * Single in-flight /api/sync per tab. The Sync button, AutoSync and the Settings
 * page all trigger the same pipeline; without this they fire concurrently on a
 * fresh page load. The server holds the authoritative lock (lib/syncLock.ts) —
 * this just avoids the pointless second request.
 */
export interface SyncResponse {
  ok: boolean;
  busy?: boolean;
  message?: string;
  error?: string;
  sync?: { inserted: number; skipped: number; fetched: number };
  parse?: { parsed: number; merged: number };
  categorize?: { byRule: number; byLlm: number };
}

let inFlight: Promise<SyncResponse> | null = null;

export function runSync(): Promise<SyncResponse> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const res = await fetch('/api/sync', { method: 'POST' }).catch(() => null);
    if (!res) return { ok: false, error: 'Couldn’t reach SpendWise. Check your connection and try again.' };
    // A crash or timeout on the host returns a plain-text error page, not JSON.
    const data = (await res.json().catch(() => null)) as SyncResponse | null;
    if (data) return data;
    return {
      ok: false,
      error: res.status === 504 ? 'Sync took too long and was stopped. Try again — it picks up where it left off.' : `Sync failed on the server (${res.status}). Try again in a minute.`,
    };
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
