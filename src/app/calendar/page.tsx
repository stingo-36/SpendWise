'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { inr } from '@/lib/format';

interface CalEvent {
  date: string;
  kind: 'in' | 'out' | 'bill' | 'cycle';
  label: string;
  amount: number | null;
  projected: boolean;
}

interface MonthData {
  month: string;
  events: CalEvent[];
  expectedIn: number;
  fixedOut: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function shift(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const PILL: Record<CalEvent['kind'], string> = {
  in: 'bg-sky text-[rgb(var(--peri-2))]',
  out: 'bg-blush text-[#8A3109]',
  bill: 'bg-[rgb(var(--ink))] text-white',
  cycle: 'bg-surface-2 text-muted',
};
const DOT: Record<CalEvent['kind'], string> = { in: 'bg-[rgb(var(--peri))]', out: 'bg-[#E8833A]', bill: 'bg-[rgb(var(--ink))]', cycle: 'bg-muted-soft' };

/** Salary, recurring payments and card dates on one month grid. */
export default function CalendarPage() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const todayKey = `${thisMonth}-${pad(now.getDate())}`;
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar?month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  const [y, m] = month.split('-').map(Number);
  const title = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Monday-first grid: blanks before the 1st, then each day with its events.
  const cells = useMemo(() => {
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const byDate = new Map<string, CalEvent[]>();
    for (const e of data?.events ?? []) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
    const out: ({ day: number; key: string; events: CalEvent[] } | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) {
      const key = `${month}-${pad(d)}`;
      out.push({ day: d, key, events: byDate.get(key) ?? [] });
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [data, month, y, m]);

  const free = data ? data.expectedIn - data.fixedOut : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Calendar · what’s coming and when</div>
          <h1 className="h-page mt-1.5">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(shift(month, -1))} className="btn-outline px-3" aria-label="Previous month">
            ‹
          </button>
          <button onClick={() => setMonth(thisMonth)} className="btn-outline px-4" disabled={month === thisMonth}>
            Today
          </button>
          <button onClick={() => setMonth(shift(month, 1))} className="btn-outline px-3" aria-label="Next month">
            ›
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className={`card p-3 sm:p-4 ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {DOW.map((d) => (
              <div key={d} className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.07em] text-muted sm:text-left">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
            {cells.map((c, i) =>
              c ? (
                <div
                  key={c.key}
                  className={`flex min-h-11 flex-col items-center gap-1 rounded-xl p-1 sm:min-h-[104px] sm:items-stretch sm:border sm:border-[#C4C9D1] sm:p-2 ${
                    c.key === todayKey ? 'ring-2 ring-[rgb(var(--ink))]' : ''
                  } ${c.events.some((e) => e.kind === 'bill') ? 'sm:bg-surface-2' : 'sm:bg-surface'}`}
                >
                  <span className={`tabular text-[13px] ${c.key === todayKey ? 'font-bold' : 'text-muted'}`}>{c.day}</span>
                  {/* Phone: dots. Wider: labelled pills. */}
                  <span className="flex gap-0.5 sm:hidden">
                    {c.events.slice(0, 3).map((e, j) => (
                      <span key={j} className={`h-1.5 w-1.5 rounded-full ${DOT[e.kind]}`} />
                    ))}
                  </span>
                  <span className="hidden flex-col gap-1 sm:flex">
                    {c.events.slice(0, 3).map((e, j) => (
                      <span key={j} className={`truncate rounded-md px-1.5 py-1 text-[11px] font-semibold leading-tight ${PILL[e.kind]}`} title={e.label}>
                        {e.label}
                        {e.amount != null && ` ${e.kind === 'in' ? '+' : ''}${inr(e.amount).replace('.00', '')}`}
                      </span>
                    ))}
                    {c.events.length > 3 && <span className="text-[11px] text-muted">+{c.events.length - 3} more</span>}
                  </span>
                </div>
              ) : (
                <div key={`b${i}`} className="hidden rounded-xl border border-dashed border-[#D2D6DC] sm:block" />
              ),
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="card-hero flex flex-col gap-2.5 p-5">
            <span className="eyebrow !text-[rgb(var(--sidebar-muted))]">{title.split(' ')[0]}, expected</span>
            <div className="flex justify-between text-sm">
              <span>Coming in</span>
              <span className="tabular text-[#9FB8F0]">+{inr(data?.expectedIn ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Fixed going out</span>
              <span className="tabular text-[#F2A46B]">−{inr(data?.fixedOut ?? 0)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-white/10 pt-2.5 font-bold">
              <span>Free to spend</span>
              <span className="font-display text-2xl tabular text-amber">{inr(free)}</span>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="h-section mb-1">Agenda</h2>
            {!data || data.events.length === 0 ? (
              <p className="text-sm text-muted">Nothing on the calendar this month.</p>
            ) : (
              <ul>
                {data.events
                  .filter((e) => e.kind !== 'cycle')
                  .map((e, i) => (
                    <li key={i} className="flex items-center gap-3 border-t border-border py-2.5 text-sm first:border-t-0">
                      <span className="tabular w-12 shrink-0 text-xs text-muted">
                        {Number(e.date.slice(8))} {title.slice(0, 3)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.label}</span>
                        {e.projected && e.kind !== 'bill' && <span className="text-[11px] text-muted">expected</span>}
                      </span>
                      {e.kind === 'bill' ? (
                        <span className="chip bg-[rgb(var(--ink))] text-white">
                          <Icon name="creditcard" size={12} /> bill
                        </span>
                      ) : (
                        <span className={`tabular font-semibold ${e.kind === 'in' ? 'text-credit' : 'text-debit'}`}>
                          {e.kind === 'in' ? '+' : '−'}
                          {inr(e.amount ?? 0)}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`chip ${PILL.in}`}>Money in</span>
            <span className={`chip ${PILL.out}`}>Recurring out</span>
            <span className={`chip ${PILL.bill}`}>Card bill</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
