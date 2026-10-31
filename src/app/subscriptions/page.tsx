'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inr, fmtDate } from '@/lib/format';
import Icon from '@/components/Icon';
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
  active: { soft: '#E4EDFB', ink: '#164C9E', solid: '#1D5FC4', icon: 'check', label: 'Active' },
  price_changed: { soft: '#FBEBDD', ink: '#8A3109', solid: '#E8833A', icon: 'alert', label: 'Price up' },
  stopped: { soft: '#EEF0F3', ink: '#4A515C', solid: '#5B6270', icon: 'close', label: 'Stopped' },
  dismissed: { soft: '#EEF0F3', ink: '#4A515C', solid: '#8A919C', icon: 'close', label: 'Removed' },
};

function statusOf(s: string) {
  return STATUS[s] ?? STATUS.stopped;
}

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

  const soonTotal = soon.reduce((sum, x) => sum + Number(x.medianAmount), 0);

  const remove = (x: Sub) => {
    if (confirm(`Remove ${x.merchant}? Re-detect won’t add it back.`)) setStatus(x.id, 'dismissed');
  };
  const nextLabel = (x: Sub) => {
    const days = daysUntil(x.nextExpected);
    return days >= 0 && days <= 7 ? (days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`) : null;
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {adding && <AddSubscription kind={tab === 'recurring' ? 'recurring' : 'subscription'} onAdded={load} onClose={() => setAdding(false)} />}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Detected from your history</div>
          <h1 className="h-page mt-1.5">Recurring</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={detect} disabled={detecting} className="btn-outline flex-1 whitespace-nowrap px-4 sm:flex-none">
            <Icon name="repeat" size={15} className={detecting ? 'animate-spin' : undefined} /> {detecting ? 'Detecting…' : 'Re-detect'}
          </button>
          <button onClick={() => setAdding(true)} className="btn-accent flex-1 whitespace-nowrap px-4 sm:flex-none">
            <Icon name="plus" size={15} /> Add by hand
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="card-hero p-5">
          <div className="eyebrow !text-[rgb(var(--sidebar-muted))]">Monthly cost</div>
          <div className="mt-2 font-display text-[40px] font-extrabold leading-none tabular text-amber">{inr(monthly)}</div>
          <div className="mt-2 text-xs text-[rgb(var(--sidebar-muted))]">Annual ÷ 12, quarterly ÷ 3, plus monthlies</div>
        </div>
        <div className="card p-5">
          <div className="eyebrow">Next 7 days</div>
          <div className="mt-2 font-display text-[40px] font-extrabold leading-none tabular">{soon.length}</div>
          <div className="mt-2 text-xs text-muted">{soon.length ? `${inr(soonTotal)} going out` : `${activeCount} active, none due this week`}</div>
        </div>
        <div className={`rounded-[20px] p-5 ${priceChanged.length ? 'bg-blush' : 'bg-surface'}`}>
          <div className={`eyebrow ${priceChanged.length ? '!text-[#8A3109]' : ''}`}>Price went up</div>
          <div className="mt-2 font-display text-[40px] font-extrabold leading-none tabular">{priceChanged.length}</div>
          <div className={`mt-2 truncate text-xs ${priceChanged.length ? 'text-[#6B2A0A]' : 'text-muted'}`}>
            {priceChanged.length ? priceChanged.map((x) => x.merchant).join(', ') : 'No changes spotted'}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          {/* Subscriptions are services you signed up for; recurring is any
              other repeating payment. */}
          <div className="seg" role="tablist" aria-label="Kind">
            {(
              [
                ['all', 'All'],
                ['subscription', 'Subscriptions'],
                ['recurring', 'Other recurring'],
              ] as [Tab, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`seg-btn ${tab === value ? 'seg-on' : ''}`}
              >
                {label} <span className="tabular text-xs text-muted">{counts[value]}</span>
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">Sorted by next charge</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted">Loading…</div>
        ) : subs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="tile mx-auto mb-3 h-12 w-12 bg-surface-2 text-muted"><Icon name="repeat" size={22} /></span>
            <p className="text-sm font-semibold">{tab === 'recurring' ? 'No recurring payments yet.' : 'Nothing detected yet.'}</p>
            <p className="mt-1 text-sm text-muted">Run Re-detect after syncing, or add one by hand.</p>
          </div>
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.07em] text-muted">
                    <th className="px-5 py-2.5 font-semibold">Service</th>
                    <th className="px-3 py-2.5 font-semibold">Cadence</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2.5 font-semibold">Next</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subs.map((x) => {
                    const st = statusOf(x.status);
                    const soonText = nextLabel(x);
                    return (
                      <tr key={x.id} className="group hover:bg-surface-2/50">
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold" style={{ background: st.soft, color: st.ink }}>
                              {x.merchant.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate font-semibold">{x.merchant}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 capitalize text-muted">{x.cadence}</td>
                        <td className="tabular px-3 py-3 text-right font-semibold">{inr(x.medianAmount)}</td>
                        <td className="px-3 py-3">
                          <span className="tabular">{fmtDate(x.nextExpected)}</span>
                          {soonText && <span className="chip ml-2 bg-sand text-[rgb(var(--amber-2))]">{soonText}</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="chip" style={{ background: st.soft, color: st.ink }}>
                            <Icon name={st.icon} size={11} /> {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => remove(x)}
                            className="ml-auto grid h-9 w-9 place-items-center rounded-lg bg-[#FBE3D3] text-[#9A3412] transition-colors hover:bg-debit hover:text-white"
                            aria-label={`Remove ${x.merchant}`}
                            title="Remove"
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phones: list */}
            <ul className="divide-y divide-border sm:hidden">
              {subs.map((x) => {
                const st = statusOf(x.status);
                const soonText = nextLabel(x);
                return (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold" style={{ background: st.soft, color: st.ink }}>
                      {x.merchant.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{x.merchant}</div>
                      <div className="truncate text-xs text-muted">
                        <span className="capitalize">{x.cadence}</span> · {fmtDate(x.nextExpected)}
                        {soonText && ` · ${soonText}`}
                        {x.status === 'price_changed' && ' · price up'}
                      </div>
                    </div>
                    <span className="tabular text-sm font-semibold">{inr(x.medianAmount)}</span>
                    <button onClick={() => remove(x)} className="grid h-9 w-9 place-items-center rounded-lg bg-[#FBE3D3] text-[#9A3412] hover:bg-debit hover:text-white" aria-label={`Remove ${x.merchant}`}>
                      <Icon name="trash" size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
