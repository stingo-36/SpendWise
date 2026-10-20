'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CategoryManager from '@/components/CategoryManager';

interface Status {
  gmail: { connected: boolean; email: string | null };
  llmConfigured: boolean;
  counts: { rawEmails: number; pending: number; unparsed: number; transactions: number; reviewQueue: number };
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

function SettingsInner() {
  const params = useSearchParams();
  const gmailOk = params.get('gmail') === 'connected';
  const gmailError = params.get('gmail_error');
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Retry a couple of times — dev HMR can momentarily 404 a recompiling route.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (res.ok) {
          setStatus(await res.json());
          return;
        }
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function wipe() {
    if (!confirm('Delete ALL transactions and emails? Categories & rules are kept. This cannot be undone.')) return;
    setBusy('delete');
    await fetch('/api/data?confirm=DELETE', { method: 'DELETE' });
    await load();
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <h1 className="h-page">Settings</h1>

      {gmailOk && <div className="rounded-lg border border-credit/40 bg-credit/5 p-3 text-sm text-credit">✓ Gmail connected.</div>}
      {gmailError && (
        <div className="rounded-lg border border-debit/40 bg-debit/5 p-3 text-sm">
          <span className="font-medium text-debit">Gmail connection failed:</span> {gmailError}
          {/missing|not set|env/i.test(gmailError) && (
            <span className="text-muted"> — the Google credentials aren’t set up yet. Ask your SpendWise admin to add them under App settings.</span>
          )}
        </div>
      )}

      {/* Gmail */}
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <h2 className="text-sm font-semibold">Gmail (read-only)</h2>
        {status?.gmail.connected ? (
          <p className="text-sm text-credit">✓ Connected{status.gmail.email ? ` as ${status.gmail.email}` : ''}</p>
        ) : (
          <p className="text-sm text-muted">Not connected.</p>
        )}
        <a href="/api/auth/google" className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm">
          {status?.gmail.connected ? 'Reconnect' : 'Connect Gmail'}
        </a>
        <p className="text-xs text-muted">Scope: gmail.readonly only. The app never writes to any account.</p>
      </section>

      {/* Category management */}
      <CategoryManager />

      {/* Data */}
      <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <h2 className="text-sm font-semibold">Data export & delete</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?format=json" className="rounded-lg border border-border px-3 py-1.5 text-sm">Export JSON</a>
          <a href="/api/export?format=csv" className="rounded-lg border border-border px-3 py-1.5 text-sm">Export CSV</a>
          <button onClick={wipe} disabled={busy === 'delete'} className="rounded-lg border border-debit/50 text-debit px-3 py-1.5 text-sm">
            Delete all data
          </button>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-muted">Loading…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
