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

const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

function SettingsInner() {
  const params = useSearchParams();
  const gmailOk = params.get('gmail') === 'connected';
  const gmailError = params.get('gmail_error');
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [statementDay, setStatementDay] = useState(15);

  useEffect(() => {
    fetch('/api/credit-cards', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.statementDay && setStatementDay(d.statementDay))
      .catch(() => {});
  }, []);

  async function changeDay(day: number) {
    setStatementDay(day);
    await fetch('/api/credit-cards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statementDay: day }) });
  }

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

  const section = 'card flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:gap-8';
  const lead = 'flex flex-col gap-1.5 md:w-64 md:shrink-0';

  return (
    <div className="space-y-4 sm:space-y-5">
      <header>
        <div className="eyebrow">Account and data</div>
        <h1 className="h-page mt-1.5">Settings</h1>
      </header>

      <nav aria-label="Settings sections" className="seg self-start">
        {[
          ['#gmail', 'Gmail'],
          ['#card-bill', 'Card bill'],
          ['#categories', 'Categories'],
          ['#data', 'Data'],
        ].map(([href, label]) => (
          <a key={href} href={href} className="seg-btn">
            {label}
          </a>
        ))}
      </nav>

      {gmailOk && <div className="rounded-2xl bg-sky p-3 text-sm font-semibold text-[rgb(var(--peri-2))]">✓ Gmail connected.</div>}
      {gmailError && (
        <div className="rounded-2xl bg-blush p-3 text-sm text-[#6B2A0A]">
          <span className="font-semibold">Gmail connection failed:</span> {gmailError}
          {/missing|not set|env/i.test(gmailError) && <span> — the Google credentials aren’t set up yet. Ask your SpendWise admin to add them under App settings.</span>}
        </div>
      )}

      <section id="gmail" className={`${section} scroll-mt-6`}>
        <div className={lead}>
          <h2 className="h-section">Gmail</h2>
          <p className="text-sm leading-relaxed text-muted">Read-only access to bank alert senders. SpendWise never writes to any account.</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-4">
          <span className={`tile h-11 w-11 shrink-0 font-display text-lg font-extrabold ${status?.gmail.connected ? 'bg-[rgb(var(--ink))] text-amber' : 'bg-surface text-muted'}`}>G</span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">{status?.gmail.connected ? 'Connected' : 'Not connected'}</div>
            <div className="tabular truncate text-xs text-muted">{status?.gmail.email ?? 'Scope: gmail.readonly'}</div>
          </div>
          <a href="/api/auth/google" className={status?.gmail.connected ? 'btn-outline' : 'btn-primary'}>
            {status?.gmail.connected ? 'Reconnect' : 'Connect Gmail'}
          </a>
        </div>
      </section>

      <section id="card-bill" className={`${section} scroll-mt-6`}>
        <div className={lead}>
          <h2 className="h-section">Credit card bill</h2>
          <p className="text-sm leading-relaxed text-muted">The day your statement is generated. Card spend follows this cycle on Home and Cards.</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <label className="flex flex-wrap items-center gap-2.5 text-sm font-semibold">
            Bill generates on the
            <select value={statementDay} onChange={(e) => changeDay(Number(e.target.value))} className="select !w-auto">
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {ordinal(i + 1)}
                </option>
              ))}
            </select>
            of every month
          </label>
          <a href="/credit-card" className="btn-outline ml-auto">
            Manage cards
          </a>
        </div>
      </section>

      <section id="categories" className="scroll-mt-6">
        <CategoryManager />
      </section>

      <section id="data" className={`${section} scroll-mt-6`}>
        <div className={lead}>
          <h2 className="h-section">Your data</h2>
          <p className="text-sm leading-relaxed text-muted">Take everything with you, or wipe it.</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <a href="/api/export?format=json" className="btn-outline">Export JSON</a>
            <a href="/api/export?format=csv" className="btn-outline">Export CSV</a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blush p-4">
            <div className="text-[#6B2A0A]">
              <div className="font-bold">Delete all transactions and emails</div>
              <div className="text-xs">Categories and rules are kept. The next sync rebuilds from Gmail.</div>
            </div>
            <button onClick={wipe} disabled={busy === 'delete'} className="btn bg-debit px-4 text-white hover:brightness-95">
              {busy === 'delete' ? 'Deleting…' : 'Delete…'}
            </button>
          </div>
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
