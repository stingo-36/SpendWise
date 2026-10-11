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
    const res = await fetch('/api/sync', { method: 'POST' });
    return (await res.json()) as SyncResponse;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
