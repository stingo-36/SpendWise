'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import Reveal from '@/components/Reveal';
import CategoryWeekChart, { type WeeklyCategorySpend } from '@/components/CategoryWeekChart';
import RecentTransactions from '@/components/RecentTransactions';
import BudgetWidget from '@/components/BudgetWidget';
import AddTransaction from '@/components/AddTransaction';
import { categoryColor } from '@/lib/palette';
import { DATA_CHANGED_EVENT } from '@/lib/navLinks';

interface Overview {
  month: string;
  totalSpend: number;
  totalMoneyIn: number;
  allMoneyOut: number;
  prevMonthSpend: number;
  accountOutflow: number;
  creditCardSpend: number;
  cardBillPaid: number;
  cardOutstanding: number;
  cardCycle: { from: string; to: string; label: string; statementDate: string; charged: number };
  deltaPct: number | null;
  categoryBreakdown: { categoryId: number | null; categoryName: string; amount: number }[];
  incomeBreakdown: { categoryId: number | null; categoryName: string; amount: number }[];
  topMerchants: { merchant: string; amount: number }[];
  txnCount: number;
  uncategorizedCount: number;
  weekly: WeeklyCategorySpend;
}

interface Sub {
  id: number;
  merchant: string;
  medianAmount: string;
  nextExpected: string;
  status: string;
}

function monthOptions(): string[] {
  const out: string[] = [];
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  for (let i = 0; i < 12; i++) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m--;
    if (m < 0) {
      m = 11;
      y--;
    }
  }
  return out;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** "2026-11-15" → local midnight of that day. */
function ymdDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-11-15" → "15 Nov" */
function fmtDay(ymd: string): string {
  return ymdDate(ymd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const DAY = 86_400_000;

export default function HomePage() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<Overview | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'expense' | 'income'>('expense');
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/overview?month=${m}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(month);
  }, [month, refresh]);

  // A transaction added from the tab bar changes the numbers.
  useEffect(() => {
    const onChange = () => refresh(month);
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [month, refresh]);

  useEffect(() => {
    fetch('/api/subscriptions')
      .then((r) => (r.ok ? r.json() : { subscriptions: [] }))
      .then((d) => setSubs(d.subscriptions ?? []))
      .catch(() => {});
  }, []);

  // Card charges are spend but haven't left the account yet, so what's left in
  // the account nets money in against account outflow only — never against
  // totalSpend, which includes charges still sitting on the card.
  const leftInAccount = data ? data.totalMoneyIn - data.accountOutflow : 0;
  const savedPct = data && data.totalMoneyIn > 0 ? Math.round((leftInAccount / data.totalMoneyIn) * 100) : null;

  // How far through the card cycle we are, for the progress bar.
  const cycle = useMemo(() => {
    if (!data) return null;
    const start = ymdDate(data.cardCycle.from).getTime();
    const end = ymdDate(data.cardCycle.to).getTime();
    const total = Math.round((end - start) / DAY) + 1;
    const day = Math.min(total, Math.max(1, Math.floor((Date.now() - start) / DAY) + 1));
    return { total, day, pct: Math.round((day / total) * 100) };
  }, [data]);

  const breakdown = data ? (view === 'expense' ? data.categoryBreakdown : data.incomeBreakdown) : [];
  const breakdownTotal = breakdown.reduce((s, c) => s + c.amount, 0);

  // Next few recurring charges plus the card bill date.
  const upcoming = useMemo(() => {
    const today = new Date(new Date().toDateString()).getTime();
    const rows: { key: string; date: string; label: string; amount: string | null; bill?: boolean }[] = subs
      .filter((s) => (s.status === 'active' || s.status === 'price_changed') && ymdDate(s.nextExpected).getTime() >= today)
      .map((s) => ({ key: `s${s.id}`, date: s.nextExpected, label: s.merchant, amount: s.medianAmount }));
    if (data && ymdDate(data.cardCycle.statementDate).getTime() >= today) {
      rows.push({ key: 'bill', date: data.cardCycle.statementDate, label: 'Card bill generated', amount: null, bill: true });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [subs, data]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="relative z-30 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">{today}</div>
          <h1 className="h-page mt-1.5">{monthLabel(month).split(' ')[0]} at a glance</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Select
            value={month}
            options={months.map((m) => ({ value: m, label: monthLabel(m), icon: 'calendar' }))}
            onChange={setMonth}
            align="right"
            className="!w-auto min-w-[11rem]"
          />
          <button onClick={() => setAdding(true)} className="btn-accent hidden px-4 lg:inline-flex">
            <Icon name="plus" size={16} /> Add
          </button>
        </div>
      </header>

      {loading || !data || !cycle ? (
        <div className="py-16 text-center text-muted animate-fade-in">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Hero: what's left in the account */}
            <section className="card-hero flex flex-col gap-4 p-5 sm:p-6 xl:col-span-2 animate-pop">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow !text-[rgb(var(--sidebar-muted))]">Left in account</span>
                {savedPct != null && (
                  <span className="chip bg-white/[0.08] text-amber">{savedPct >= 0 ? `${savedPct}% saved` : 'Spent more than came in'}</span>
                )}
              </div>
              <div
                className={`font-display text-[clamp(2.75rem,8vw,5rem)] font-extrabold leading-none tracking-[-0.03em] tabular ${
                  leftInAccount >= 0 ? 'text-amber' : 'text-[#F2A46B]'
                }`}
              >
                {inr(leftInAccount)}
              </div>
              <div className="grid grid-cols-1 gap-2.5 xs:grid-cols-3">
                <div className="rounded-2xl bg-white/[0.06] p-3.5">
                  <div className="text-xs text-[rgb(var(--sidebar-muted))]">Money in</div>
                  <div className="tabular text-lg font-semibold text-[#9FB8F0]">+{inr(data.totalMoneyIn)}</div>
                </div>
                <div className="rounded-2xl bg-white/[0.06] p-3.5">
                  <div className="text-xs text-[rgb(var(--sidebar-muted))]">Out of account</div>
                  <div className="tabular text-lg font-semibold text-[#F2A46B]">−{inr(data.accountOutflow)}</div>
                  {data.cardBillPaid > 0 && <div className="text-[11px] text-[rgb(var(--sidebar-muted))]">incl. {inr(data.cardBillPaid)} card bill</div>}
                </div>
                <div className="rounded-2xl bg-white/[0.06] p-3.5">
                  <div className="text-xs text-[rgb(var(--sidebar-muted))]">Total spend</div>
                  <div className="tabular text-lg font-semibold">{inr(data.totalSpend)}</div>
                  <div className="text-[11px] text-[rgb(var(--sidebar-muted))]">
                    {data.deltaPct == null
                      ? 'card + account'
                      : Math.abs(data.deltaPct) > 300
                        ? `${inr(data.prevMonthSpend)} last month`
                        : `${data.deltaPct > 0 ? '▲' : '▼'} ${Math.abs(data.deltaPct)}% vs last month`}
                  </div>
                </div>
              </div>
            </section>

            {/* Card cycle */}
            <section className="card flex flex-col gap-3.5 p-5 animate-pop" style={{ animationDelay: '70ms' }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="h-section">Card cycle</h2>
                <span className="text-sm font-medium text-muted">{data.cardCycle.label}</span>
              </div>
              <div className="font-display text-[40px] font-extrabold leading-none tabular">{inr(data.cardCycle.charged)}</div>
              <div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-[rgb(var(--ink))]" style={{ width: `${cycle.pct}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-muted">
                  <span>
                    Day {cycle.day} of {cycle.total}
                  </span>
                  <span>Bill on {fmtDay(data.cardCycle.statementDate)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-border pt-3.5">
                <span className={`tile h-9 w-9 shrink-0 ${data.cardBillPaid > 0 ? 'bg-sky text-[rgb(var(--peri-2))]' : 'bg-surface-2 text-muted'}`}>
                  <Icon name={data.cardBillPaid > 0 ? 'check' : 'creditcard'} size={16} />
                </span>
                <div className="min-w-0 text-sm">
                  <div className="font-semibold">{data.cardBillPaid > 0 ? `${inr(data.cardBillPaid)} bill paid` : 'No bill paid this month'}</div>
                  <div className="text-xs text-muted">{data.cardOutstanding > 0 ? `${inr(data.cardOutstanding)} still due` : 'All cleared'}</div>
                </div>
              </div>
              <Link href="/credit-card" className="text-sm font-semibold text-[rgb(var(--peri))] hover:underline">
                Open Cards →
              </Link>
            </section>
          </div>

          {/* Two independent columns: each stacks its own cards, so a short
              card never stretches to match a tall neighbour. */}
          <Reveal className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3" delay={40}>
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            <section className="card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="h-section">{view === 'expense' ? 'Where it went' : 'Where it came from'}</h2>
                <div className="seg" role="group" aria-label="Show">
                  {(['expense', 'income'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`seg-btn min-h-9 ${view === v ? 'seg-on' : ''}`}
                    >
                      {v === 'expense' ? 'Spend' : 'Income'}
                    </button>
                  ))}
                </div>
              </div>
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet this month.</p>
              ) : (
                <>
                  <div className="flex h-3.5 overflow-hidden rounded-full bg-surface-2">
                    {breakdown.map((c) => (
                      <span
                        key={c.categoryName}
                        title={`${c.categoryName} ${inr(c.amount)}`}
                        style={{ width: `${(c.amount / breakdownTotal) * 100}%`, background: categoryColor(c.categoryName, view === 'expense') }}
                      />
                    ))}
                  </div>
                  <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                    {breakdown.slice(0, 8).map((c) => (
                      <li key={c.categoryName} className="flex items-center gap-2.5 border-t border-border py-2.5 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: categoryColor(c.categoryName, view === 'expense') }} />
                        <span className="flex-1 truncate">{c.categoryName}</span>
                        <span className="tabular">{inr(c.amount)}</span>
                        <span className="tabular w-10 text-right text-muted">{Math.round((c.amount / breakdownTotal) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
              <RecentTransactions month={month} />
            <section className="card p-5">
              <h2 className="h-section mb-3">Week by week · {monthLabel(month)}</h2>
              <CategoryWeekChart data={data.weekly} />
            </section>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              {data.uncategorizedCount > 0 && (
                <Link href="/review" className="flex items-center gap-3 rounded-[20px] bg-blush p-4 text-[#6B2A0A] hover:brightness-[0.98]">
                  <span className="tile h-10 w-10 shrink-0 bg-[rgb(var(--ink))] font-mono text-sm font-bold text-amber">{data.uncategorizedCount}</span>
                  <span className="flex-1">
                    <span className="block font-bold">
                      {data.uncategorizedCount} payment{data.uncategorizedCount === 1 ? '' : 's'} need a category
                    </span>
                    <span className="text-xs">One tap each in your Inbox</span>
                  </span>
                  <span aria-hidden>→</span>
                </Link>
              )}
              <BudgetWidget month={month} />
              <section className="card p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="h-section">Coming up</h2>
                  <Link href="/calendar" className="text-xs font-semibold text-[rgb(var(--peri))] hover:underline">
                    Calendar →
                  </Link>
                </div>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted">Nothing scheduled. Recurring payments show up here once detected.</p>
                ) : (
                  <ul>
                    {upcoming.map((u) => (
                      <li key={u.key} className="flex items-center gap-3 border-t border-border py-2.5 text-sm first:border-t-0">
                        <span className="tabular w-14 shrink-0 text-xs text-muted">{fmtDay(u.date)}</span>
                        <span className="flex-1 truncate font-semibold">{u.label}</span>
                        {u.bill ? (
                          <span className="tabular whitespace-nowrap text-sm font-semibold text-text">~{inr(data.cardCycle.charged)}</span>
                        ) : (
                          <span className="tabular text-debit">−{inr(u.amount ?? 0)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            <section className="card p-5">
              <h2 className="h-section mb-2">Top merchants</h2>
              {data.topMerchants.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet.</p>
              ) : (
                <ul>
                  {data.topMerchants.slice(0, 6).map((m, i) => (
                    <li key={m.merchant} className="flex items-center gap-3 border-t border-border py-2.5 text-sm first:border-t-0">
                      <span className="tabular w-5 text-muted">{i + 1}</span>
                      <span className="flex-1 truncate font-semibold">{m.merchant}</span>
                      <span className="tabular">{inr(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            </div>
          </Reveal>
        </>
      )}

      {adding && <AddTransaction onAdded={() => refresh(month)} onClose={() => setAdding(false)} />}
    </div>
  );
}
