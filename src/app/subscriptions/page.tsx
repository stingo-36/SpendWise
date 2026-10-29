'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inr, fmtDate } from '@/lib/format';
import Icon from '@/components/Icon';
import Reveal from '@/components/Reveal';
import AddSubscription from '@/components/AddSubscription';

interface Sub {
  id: number;
  merchant: string;
  medianAmount: string;
  intervalDays: number;
  cadence: string;
  firstSeen: string;
  lastCharged: string;
  nextExpected: string;
  status: string;
  kind: 'subscription' | 'recurring';
}

type Tab = 'all' | 'subscription' | 'recurring';

/** Monthly equivalent (§9): annual ÷ 12, quarterly ÷ 3, everything else as-is. */
function monthlyOf(s: Sub): number {
  const amt = Number(s.medianAmount);
  if (s.cadence === 'annual') return amt / 12;
  if (s.cadence === 'quarterly') return amt / 3;
  return amt;
}

/** Each status gets a ground, a label colour and a glyph — not just grey text. */
const STATUS: Record<string, { soft: string; ink: string; solid: string; icon: string; label: string }> = {
  active: { soft: '#E2F1EA', ink: '#1E6349', solid: '#2A8A69', icon: 'check', label: 'Active' },
  price_changed: { soft: '#FAECEA', ink: '#9A3F38', solid: '#D6584E', icon: 'alert', label: 'Price changed' },
  stopped: { soft: '#EDEEF1', ink: '#4E545F', solid: '#7A808A', icon: 'close', label: 'Stopped' },
  dismissed: { soft: '#EDEEF1', ink: '#4E545F', solid: '#8A909C', icon: 'close', label: 'Dismissed' },
};

function statusOf(s: string) {
  return STATUS[s] ?? STATUS.stopped;
}

/** Cadence drives the accent on each row so the list reads by rhythm. */
const CADENCE_TONE: Record<string, string> = {
  monthly: '#8095F2',
  quarterly: '#E0813C',
  annual: '#9B62B8',
  weekly: '#3D7FC1',
};

export default function SubscriptionsPage() {
  const [all, setAll] = useState<Sub[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/subscriptions');
    const data = await res.json();
    setAll(data.subscriptions);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function detect() {
    setDetecting(true);
    await fetch('/api/subscriptions/detect', { method: 'POST' });
    await load();
    setDetecting(false);
  }

  async function setStatus(id: number, status: string) {
    await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  // Removed ones are kept server-side only so Re-detect won't bring them back.
  const live = useMemo(() => all.filter((s) => s.status !== 'dismissed'), [all]);
  const subs = useMemo(() => (tab === 'all' ? live : live.filter((s) => s.kind === tab)), [live, tab]);
  const counts = useMemo(
    () => ({ all: live.length, subscription: live.filter((s) => s.kind === 'subscription').length, recurring: live.filter((s) => s.kind === 'recurring').length }),
    [live],
  );
  // Same rule as the server's normalizedMonthlyTotal, over the tab in view.
  const monthly = subs
    .filter((s) => s.status === 'active' || s.status === 'price_changed')
    .reduce((t, s) => t + monthlyOf(s), 0);
  const noun = tab === 'recurring' ? 'recurring payment' : tab === 'subscription' ? 'subscription' : 'recurring item';

  const soon = subs.filter(
    (s) => s.status !== 'dismissed' && s.status !== 'stopped' && daysUntil(s.nextExpected) <= 7 && daysUntil(s.nextExpected) >= 0,
  );
  const priceChanged = subs.filter((s) => s.status === 'price_changed');
  const activeCount = subs.filter((s) => s.status === 'active' || s.status === 'price_changed').length;

  return (
    <div className="space-y-5 pt-1">
      {adding && <AddSubscription kind={tab === 'recurring' ? 'recurring' : 'subscription'} onAdded={load} onClose={() => setAdding(false)} />}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="h-page">Subscriptions</h1>
          <p className="text-sm text-muted">Subscriptions and other recurring payments (rent, EMI, SIP) from your history.</p>
        </div>
        {/* Each button keeps its label on one line and takes an equal share of
            a narrow row; at 320px the pair used to break mid-word. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            className="btn-outline flex-1 whitespace-nowrap px-3.5 py-2 sm:flex-none"
          >
            <Icon name="plus" size={15} />
            {/* One span, so the flex gap doesn't double up with JSX's own
                whitespace between "Add" and the conditional word. */}
            <span>Add<span className="hidden min-[360px]:inline"> {tab === 'recurring' ? 'recurring' : 'subscription'}</span></span>
          </button>
          <button onClick={detect} disabled={detecting} className="btn-primary flex-1 whitespace-nowrap px-4 py-2 sm:flex-none">
            <Icon name="repeat" size={15} /> {detecting ? 'Detecting…' : 'Re-detect'}
          </button>
        </div>
      </header>

      {/* Subscriptions are services you signed up for; recurring is any other
          repeating payment. Detection can't tell them apart, so each row has
          a switch and new detections start as subscriptions. */}
      <div className="inline-flex w-full rounded-full border border-border bg-surface-2 p-0.5 text-sm sm:w-auto">
        {(
          [
            ['all', 'All'],
            ['subscription', 'Subscriptions'],
            ['recurring', 'Recurring'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 sm:flex-none ${tab === value ? 'bg-surface font-medium shadow-sm' : 'text-muted'}`}
          >
            {label} <span className="text-xs text-muted tabular">{counts[value]}</span>
          </button>
        ))}
      </div>

      {/* Headline: normalized monthly total, plus the two counts worth knowing. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card-hero animate-pop p-4 sm:p-5 sm:col-span-2">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/[0.07]" aria-hidden />
          <div className="relative flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70 sm:text-xs">
              Normalized monthly {tab === 'subscription' ? 'subscription' : 'recurring'} spend
            </div>
            <span className="tile h-9 w-9 bg-white/15 text-white"><Icon name="repeat" size={16} /></span>
          </div>
          <div className="relative mt-2 text-[28px] font-extrabold leading-tight tabular">{inr(monthly)}</div>
          <div className="relative mt-1 text-xs font-medium text-white/70">Annual ÷ 12, quarterly ÷ 3, plus monthlies.</div>
        </div>
        <div
          className="card-tinted animate-pop p-4 sm:p-5"
          style={{ ['--tone-soft' as string]: '#E2F1EA', ['--tone-border' as string]: '#2A8A6933', animationDelay: '70ms' }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--credit))] sm:text-xs">Tracking</div>
            <span className="tile h-9 w-9 bg-[rgb(var(--credit))] text-white"><Icon name="receipt" size={16} /></span>
          </div>
          <div className="mt-2 text-[28px] font-extrabold leading-tight tabular">{activeCount}</div>
          <div className="mt-1 text-xs font-semibold text-[rgb(var(--credit))]">
            {soon.length > 0 ? `${soon.length} due within 7 days` : `active ${noun}s`}
          </div>
        </div>
      </div>

      {priceChanged.length > 0 && (
        <div
          className="card-tinted animate-fade-in flex items-start gap-2.5 p-4 text-sm"
          style={{ ['--tone-soft' as string]: '#FAECEA', ['--tone-border' as string]: '#D6584E40' }}
        >
          <span className="tile h-7 w-7 shrink-0 bg-[rgb(var(--debit))] text-white"><Icon name="alert" size={14} /></span>
          <div>
            <span className="font-bold text-[rgb(var(--debit))]">Price increase</span>
            <span className="font-medium text-text"> on {priceChanged.map((s) => s.merchant).join(', ')}.</span>
          </div>
        </div>
      )}

      {soon.length > 0 && (
        <div
          className="card-tinted animate-fade-in flex items-start gap-2.5 p-4 text-sm"
          style={{ ['--tone-soft' as string]: '#FBF3E2', ['--tone-border' as string]: '#F5B84140' }}
        >
          <span className="tile h-7 w-7 shrink-0 bg-[rgb(var(--amber))] text-[rgb(var(--ink))]"><Icon name="calendar" size={14} /></span>
          <div>
            <span className="font-bold text-[rgb(var(--amber-2))]">Upcoming (≤7 days)</span>
            <span className="font-medium text-text"> — {soon.map((s) => `${s.merchant} (${fmtDate(s.nextExpected)})`).join(', ')}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm font-medium text-muted">Loading…</div>
      ) : subs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border py-12 text-center">
          <span className="tile mx-auto mb-3 h-12 w-12 bg-surface-2 text-muted"><Icon name="repeat" size={22} /></span>
          <p className="text-sm font-semibold">
            {tab === 'recurring' ? 'No recurring payments yet.' : tab === 'subscription' ? 'No subscriptions yet.' : 'No subscriptions detected yet.'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {tab === 'recurring'
              ? 'Move one here with its “Recurring” switch, or add one yourself.'
              : 'Run “Re-detect” after syncing, or add one yourself.'}
          </p>
          <button onClick={() => setAdding(true)} className="btn-primary mx-auto mt-4">
            + Add {tab === 'recurring' ? 'recurring payment' : 'subscription'}
          </button>
        </div>
      ) : (
        <Reveal delay={40}>
          <ul className="space-y-2.5">
            {subs.map((s, i) => {
              const st = statusOf(s.status);
              const tone = CADENCE_TONE[s.cadence.toLowerCase()] ?? '#7A808A';
              const days = daysUntil(s.nextExpected);
              return (
                <li
                  key={s.id}
                  className="card-tinted animate-fade-up flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 sm:flex-row sm:items-center"
                  style={{
                    ['--tone-soft' as string]: `${tone}12`,
                    ['--tone-border' as string]: `${tone}33`,
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {/* Cadence stripe + merchant */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className="tile h-11 w-11 shrink-0 text-white"
                      style={{ background: tone }}
                    >
                      <Icon name="repeat" size={19} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-extrabold">
                        {s.merchant}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted">
                        <span className="rounded-full px-2 py-0.5 capitalize" style={{ background: `${tone}22`, color: tone }}>
                          {s.cadence}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Icon name="calendar" size={11} />
                          {fmtDate(s.nextExpected)}
                          {days >= 0 && days <= 7 && <span className="text-[rgb(var(--amber-2))]">· in {days}d</span>}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Amount + status + action */}
                  <div className="flex min-w-0 items-center justify-between gap-2 sm:shrink-0 sm:gap-3 sm:justify-end">
                    <div className="shrink-0 text-[15px] font-extrabold tabular text-debit">
                      −{inr(s.medianAmount)}
                    </div>
                    <span
                      className="badge badge-lg"
                      style={{ ['--tone-soft']: st.soft, ['--tone-ink']: st.ink, ['--tone-border']: `${st.solid}40` } as React.CSSProperties}
                    >
                      <Icon name={st.icon} size={11} /> {st.label}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${s.merchant}? Re-detect won’t add it back.`)) setStatus(s.id, 'dismissed');
                      }}
                      className="icon-btn-danger"
                      aria-label={`Remove ${s.merchant}`}
                      title="Remove"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      )}
    </div>
  );
}

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
