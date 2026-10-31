'use client';

import { useEffect, useState } from 'react';
import { inr } from '@/lib/format';

interface Insights {
  months: { month: string; moneyIn: number; spend: number; accountOutflow: number }[];
  avgSpend: number;
  avgSavedPct: number | null;
  biggest: { month: string; spend: number } | null;
  movers: { name: string; current: number; average: number; changePct: number }[];
  topMerchants: { merchant: string; amount: number }[];
}

const RANGES = [6, 12, 24] as const;

function monthName(ym: string, style: 'short' | 'long' = 'short'): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: style });
}

/** The long view: months side by side, what moved, and where the money went. */
export default function InsightsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(12);
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights?months=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [range]);

  const peak = data ? Math.max(1, ...data.months.map((m) => Math.max(m.moneyIn, m.spend))) : 1;
  const fastest = data?.movers.filter((m) => m.changePct > 0).sort((a, b) => b.changePct - a.changePct)[0];
  const topMerchant = data?.topMerchants[0]?.amount ?? 1;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">The long view</div>
          <h1 className="h-page mt-1.5">Insights</h1>
        </div>
        <div className="seg self-start sm:self-auto" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`seg-btn ${range === r ? 'seg-on' : ''}`}>
              {r} months
            </button>
          ))}
        </div>
      </header>

      {loading || !data ? (
        <div className="py-16 text-center text-muted animate-fade-in">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card p-4 sm:p-5">
              <div className="eyebrow">Avg monthly spend</div>
              <div className="mt-2 font-display text-2xl font-extrabold tabular sm:text-3xl">{inr(data.avgSpend)}</div>
            </div>
            <div className="card p-4 sm:p-5">
              <div className="eyebrow">Avg saved</div>
              <div className="mt-2 font-display text-2xl font-extrabold tabular sm:text-3xl">{data.avgSavedPct == null ? '—' : `${data.avgSavedPct}%`}</div>
            </div>
            <div className="card p-4 sm:p-5">
              <div className="eyebrow">Biggest month</div>
              <div className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">{data.biggest ? monthName(data.biggest.month, 'long') : '—'}</div>
              {data.biggest && <div className="tabular mt-1 text-xs text-muted">{inr(data.biggest.spend)}</div>}
            </div>
            <div className="card-ink p-4 sm:p-5">
              <div className="eyebrow !text-[rgb(var(--sidebar-muted))]">Fastest growing</div>
              <div className="mt-2 truncate font-display text-2xl font-extrabold text-amber sm:text-3xl">{fastest ? fastest.name.split(' › ').pop() : '—'}</div>
              {fastest && <div className="mt-1 text-xs text-[rgb(var(--sidebar-muted))]">+{fastest.changePct}% vs 6-month average</div>}
            </div>
          </div>

          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="h-section">Money in vs spend</h2>
              <div className="flex gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-[rgb(var(--peri))]" /> In
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-[#E8833A]" /> Spend
                </span>
              </div>
            </div>
            <div className="scroll-x">
              <div className="flex min-w-[560px] gap-2" style={{ height: 220 }}>
                {data.months.map((m, i) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end justify-center gap-[3px] border-b border-border">
                      <span
                        className="w-3 rounded-t-[4px] bg-[rgb(var(--peri))]"
                        style={{ height: `${(m.moneyIn / peak) * 100}%` }}
                        title={`${monthName(m.month, 'long')} in ${inr(m.moneyIn)}`}
                      />
                      <span className="w-3 rounded-t-[4px] bg-[#E8833A]" style={{ height: `${(m.spend / peak) * 100}%` }} title={`${monthName(m.month, 'long')} spend ${inr(m.spend)}`} />
                    </div>
                    <span className={`tabular text-[11px] ${i === data.months.length - 1 ? 'font-semibold text-text' : 'text-muted'}`}>{monthName(m.month)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="card p-5 xl:col-span-2">
              <h2 className="h-section mb-2">Category movers</h2>
              <p className="mb-3 text-xs text-muted">This month against its 6-month average.</p>
              {data.movers.length === 0 ? (
                <p className="text-sm text-muted">Not enough history yet.</p>
              ) : (
                <div className="scroll-x">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.07em] text-muted">
                        <th className="py-2 font-semibold">Category</th>
                        <th className="py-2 text-right font-semibold">This month</th>
                        <th className="py-2 text-right font-semibold">Average</th>
                        <th className="py-2 text-right font-semibold">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movers.map((mv) => (
                        <tr key={mv.name} className="border-t border-border">
                          <td className="py-2.5 font-semibold">{mv.name}</td>
                          <td className="tabular py-2.5 text-right">{inr(mv.current)}</td>
                          <td className="tabular py-2.5 text-right text-muted">{inr(mv.average)}</td>
                          <td className={`tabular py-2.5 text-right font-semibold ${mv.changePct > 10 ? 'text-debit' : mv.changePct < -10 ? 'text-credit' : 'text-muted'}`}>
                            {mv.changePct > 0 ? '+' : ''}
                            {mv.changePct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="h-section mb-3">Top merchants</h2>
              {data.topMerchants.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.topMerchants.slice(0, 6).map((m) => (
                    <li key={m.merchant}>
                      <div className="mb-1.5 flex justify-between gap-2 text-sm">
                        <b className="truncate">{m.merchant}</b>
                        <span className="tabular">{inr(m.amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-[rgb(var(--ink))]" style={{ width: `${(m.amount / topMerchant) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
