'use client';

import { useEffect, useMemo, useState } from 'react';
import { inr, fmtDate } from '@/lib/format';
import Icon from './Icon';

interface Candidate {
  merchant: string;
  label: string;
  charges: number;
  amount: string;
  lastCharged: string;
  cadence: string;
  intervalDays: number;
  tracked: boolean;
}

const CADENCE_TONE: Record<string, string> = {
  monthly: '#8095F2',
  quarterly: '#E0813C',
  annual: '#9B62B8',
  weekly: '#3D7FC1',
};

/**
 * Pick a merchant you've already paid and track it as a subscription.
 *
 * Re-detect only finds three-or-more charges at a steady cadence, so a service
 * you've paid once, or one that bills on a wandering date, can never appear
 * that way. Everything here is real spend — no typing, and the amount and
 * cadence are read off the actual charges.
 */
export default function AddSubscription({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/subscriptions/candidates')
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates ?? []))
      .catch(() => setError('Could not load your merchants.'));
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = candidates ?? [];
    return (needle ? list.filter((c) => c.merchant.toLowerCase().includes(needle) || c.label.toLowerCase().includes(needle)) : list).slice(0, 60);
  }, [candidates, q]);

  async function add(c: Candidate) {
    setBusy(c.merchant);
    setError(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: c.merchant }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not add it.');
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add it.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(88vh,100dvh-1rem)] w-full flex-col rounded-t-3xl border border-border bg-surface shadow-card sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-5 pb-3">
          <div>
            <h2 className="text-base font-semibold">Add subscription</h2>
            <p className="text-xs text-muted">From merchants you&rsquo;ve already paid.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="icon-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 pb-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search merchants…"
            className="input"
          />
          {error && <p className="mt-2 text-xs font-semibold text-[rgb(var(--debit))]">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {candidates === null ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {q ? 'No merchant matches that.' : 'No spending yet — sync first.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {shown.map((c) => {
                const tone = CADENCE_TONE[c.cadence] ?? '#7A808A';
                return (
                  <li
                    key={c.merchant}
                    className="flex items-center gap-3 rounded-xl border border-border p-2.5"
                    style={{ background: `${tone}0A` }}
                  >
                    <span className="tile h-9 w-9 shrink-0 text-white" style={{ background: tone }}>
                      <Icon name="repeat" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{c.label}</div>
                      <div className="mt-0.5 truncate text-xs font-medium text-muted">
                        {c.charges} {c.charges === 1 ? 'charge' : 'charges'} · last {fmtDate(c.lastCharged)} · {c.cadence}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-extrabold tabular">{inr(c.amount)}</div>
                      {c.tracked ? (
                        <span className="text-[11px] font-semibold text-muted">Already tracked</span>
                      ) : (
                        <button
                          onClick={() => add(c)}
                          disabled={busy !== null}
                          className="mt-0.5 rounded-lg bg-[rgb(var(--ink))] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                        >
                          {busy === c.merchant ? 'Adding…' : 'Track'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
