'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inr, fmtDate } from '@/lib/format';
import Icon from '@/components/Icon';
import Select, { CategoryDropdown, type CategoryValue } from '@/components/Select';
import { useCategories } from '@/lib/useCategories';
import Reveal from '@/components/Reveal';
import { categoryStyle } from '@/lib/palette';
import { DEFAULT_STATEMENT_DAY, MAX_STATEMENT_DAY, recentCycles } from '@/lib/billingCycle';
import AddTransaction from '@/components/AddTransaction';

interface LastBill {
  label: string;
  to: string;
  amount: number;
  paid: number;
  due: number;
  lastPaidAt: string | null;
}

const DAY = 86_400_000;

interface Card {
  id: number;
  last4: string;
  label: string;
  txnCount: number;
}

interface Txn {
  id: number;
  occurredAt: string;
  amount: string;
  direction: 'debit' | 'credit';
  label: string;
  accountLast4: string | null;
  categoryId: number | null;
  categoryName: string | null;
  subcategoryId: number | null;
  subcategoryName: string | null;
}

const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

export default function CreditCardPage() {
  // Card spend follows the billing cycle (statement day D: D+1 … D), not the
  // calendar month. Index 0 is the open cycle the next bill will cover.
  const [statementDay, setStatementDay] = useState(DEFAULT_STATEMENT_DAY);
  const cycles = useMemo(() => recentCycles(statementDay, 12), [statementDay]);
  const [cycleIdx, setCycleIdx] = useState(0);
  const cycle = cycles[cycleIdx] ?? cycles[0];
  const [cards, setCards] = useState<Card[]>([]);
  const [lastBill, setLastBill] = useState<LastBill | null>(null);
  const [paying, setPaying] = useState(false);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [last4, setLast4] = useState('');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const categories = useCategories();
  const [filter, setFilter] = useState<CategoryValue>({ categoryId: null, subcategoryId: null });

  const loadCards = useCallback(async () => {
    const c = await fetch('/api/credit-cards', { cache: 'no-store' }).then((r) => r.json());
    setCards(c.cards ?? []);
    setLastBill(c.lastBill ?? null);
    if (c.statementDay) setStatementDay(c.statementDay);
  }, []);

  const loadTxns = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const t = await fetch(`/api/transactions?creditCard=1&from=${from}&to=${to}&pageSize=200`).then((r) => r.json());
      setTxns(t.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);
  useEffect(() => {
    loadTxns(cycle.from, cycle.to);
  }, [cycle.from, cycle.to, loadTxns]);

  const reload = () => Promise.all([loadCards(), loadTxns(cycle.from, cycle.to)]);

  async function changeStatementDay(v: string) {
    const day = Number(v);
    setStatementDay(day);
    setCycleIdx(0);
    await fetch('/api/credit-cards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statementDay: day }),
    });
  }

  async function addCard() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/credit-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last4: last4.trim(), label: label.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not add the card');
      setLast4('');
      setLabel('');
      setMsg(d.reclassified > 0 ? `Added — ${d.reclassified} past transaction${d.reclassified === 1 ? '' : 's'} moved to this card.` : 'Added.');
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not add the card');
    } finally {
      setBusy(false);
    }
  }

  async function removeCard(c: Card) {
    if (!confirm(`Remove ${c.label}? Its ${c.txnCount} transaction(s) go back to counting as account spend.`)) return;
    await fetch(`/api/credit-cards?id=${c.id}`, { method: 'DELETE' });
    await reload();
  }

  // Charges minus refunds — what this cycle added to the card balance.
  const { charges, refunds } = useMemo(() => {
    let charges = 0;
    let refunds = 0;
    for (const t of txns) {
      const amt = Number(t.amount);
      if (t.direction === 'credit') refunds += amt;
      else charges += amt;
    }
    return { charges, refunds };
  }, [txns]);

  // Per-card charge totals. Transactions flagged by hand on the transactions
  // page carry no accountLast4, so they'd otherwise total against no card at
  // all and every card would read ₹0.00. One card registered => they're that
  // card's; more than one => we can't attribute them, so they're reported
  // separately rather than silently dropped.
  const { byCard, unassigned } = useMemo(() => {
    const m = new Map<string, number>();
    let unassigned = 0;
    for (const t of txns) {
      if (t.direction === 'credit') continue;
      if (t.accountLast4) m.set(t.accountLast4, (m.get(t.accountLast4) ?? 0) + Number(t.amount));
      else unassigned += Number(t.amount);
    }
    if (cards.length === 1) {
      const only = cards[0].last4;
      m.set(only, (m.get(only) ?? 0) + unassigned);
      unassigned = 0;
    }
    return { byCard: m, unassigned };
  }, [txns, cards]);

  // The cycle's card charges are all loaded already, so the category filter
  // narrows the list in place; the headline above stays the whole cycle.
  const shown = useMemo(
    () =>
      txns.filter(
        (t) =>
          (filter.categoryId == null || t.categoryId === filter.categoryId) &&
          (filter.subcategoryId == null || t.subcategoryId === filter.subcategoryId),
      ),
    [txns, filter],
  );
  const shownNet = shown.reduce((s, t) => s + (t.direction === 'credit' ? -1 : 1) * Number(t.amount), 0);

  return (
    <div className="space-y-5 pt-1">
      <header className="relative z-30 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">
            Bill generates on the {ordinal(statementDay)} · cycle {ordinal(statementDay + 1)} → {ordinal(statementDay)}
          </div>
          <h1 className="h-page mt-1.5">Cards</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(cycleIdx)}
            options={cycles.map((c, i) => ({
              value: String(i),
              label: c.label,
              hint: i === 0 ? 'Current cycle' : `Billed ${c.statementDate.getFullYear()}`,
              icon: 'calendar',
            }))}
            onChange={(v) => setCycleIdx(Number(v))}
            align="right"
            className="!w-auto min-w-[12rem]"
          />
          <button onClick={() => setPaying(true)} className="btn-accent px-4">
            Record bill payment
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Headline: what went on the card this cycle */}
        <section className="card-hero flex flex-col gap-4 p-5 sm:p-6 xl:col-span-2 animate-pop">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="eyebrow !text-[rgb(var(--sidebar-muted))]">{cycleIdx === 0 ? 'Charged this cycle' : `Charged ${cycle.label}`}</span>
            {cycleIdx === 0 && (
              <span className="chip bg-white/[0.08] text-amber">
                {Math.max(0, Math.ceil((cycle.end.getTime() - DAY - Date.now()) / DAY))} days to bill
              </span>
            )}
          </div>
          <div className="font-display text-[clamp(2.75rem,8vw,4.75rem)] font-extrabold leading-none tracking-[-0.03em] tabular text-amber">
            {inr(charges - refunds)}
          </div>
          {cycleIdx === 0 && (
            <div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber"
                  style={{ width: `${Math.min(100, Math.max(0, ((Date.now() - cycle.start.getTime()) / (cycle.end.getTime() - cycle.start.getTime())) * 100))}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-[rgb(var(--sidebar-muted))] tabular">
                <span>{cycle.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                <span className="text-white">today</span>
                <span>{cycle.statementDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · bill</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl bg-white/[0.06] p-3">
              <div className="text-xs text-[rgb(var(--sidebar-muted))]">Charges</div>
              <div className="tabular font-semibold">{inr(charges)}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.06] p-3">
              <div className="text-xs text-[rgb(var(--sidebar-muted))]">Refunds</div>
              <div className="tabular font-semibold text-[#9FB8F0]">−{inr(refunds)}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.06] p-3">
              <div className="text-xs text-[rgb(var(--sidebar-muted))]">Transactions</div>
              <div className="tabular font-semibold">{txns.length}</div>
            </div>
          </div>
        </section>

        {/* The statement that's already out, and what's left to pay on it. */}
        <section className="card flex flex-col gap-3 p-5 animate-pop" style={{ animationDelay: '70ms' }}>
          <h2 className="h-section">Last bill</h2>
          {!lastBill ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <>
              <div className="tabular text-xs text-muted">{lastBill.label} · generated {fmtDate(lastBill.to)}</div>
              <div className="font-display text-4xl font-extrabold leading-none tabular">{inr(lastBill.amount)}</div>
              <div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-credit" style={{ width: `${lastBill.amount > 0 ? Math.min(100, (lastBill.paid / lastBill.amount) * 100) : 100}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-xs font-semibold">
                  <span className="text-credit">{inr(lastBill.paid)} paid</span>
                  <span className={lastBill.due > 0 ? 'text-debit' : 'text-credit'}>{lastBill.due > 0 ? `${inr(lastBill.due)} due` : 'Cleared'}</span>
                </div>
              </div>
              {lastBill.lastPaidAt && (
                <div className="flex items-center gap-3 border-t border-border pt-3 text-sm">
                  <span className="tile h-9 w-9 shrink-0 bg-sky text-[rgb(var(--peri-2))]">
                    <Icon name="check" size={16} />
                  </span>
                  <span>
                    <span className="block font-semibold">Last payment</span>
                    <span className="text-xs text-muted">{fmtDate(lastBill.lastPaidAt)}</span>
                  </span>
                </div>
              )}
              {lastBill.due > 0 && (
                <button onClick={() => setPaying(true)} className="btn-primary mt-auto">
                  Pay the rest · {inr(lastBill.due)}
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {/* Registry */}
      <Reveal delay={40}>
        <section className="card p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-[15px] font-bold">Your credit cards</h2>
            <p className="text-xs text-muted">
              Bank alerts don’t say whether a card is credit or debit — add the last 4 digits of each credit card so its charges are
              tracked here instead of being deducted from your balance.
            </p>
          </div>

          {cards.length === 0 ? (
            <p className="text-sm text-muted">No cards yet. Add one below.</p>
          ) : (
            <ul className="space-y-2">
              {cards.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                  <span className="tile h-10 w-10 bg-[rgb(var(--amber))] text-[rgb(var(--ink))]"><Icon name="creditcard" size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-bold">{c.label}</div>
                    <div className="font-mono text-xs font-medium text-muted">•••• {c.last4} · {c.txnCount} transaction{c.txnCount === 1 ? '' : 's'}</div>
                  </div>
                  <span className="text-sm font-extrabold tabular">{inr(byCard.get(c.last4) ?? 0)}</span>
                  <button onClick={() => removeCard(c)} className="icon-btn-danger" aria-label={`Remove ${c.label}`} title="Remove card">
                    <Icon name="trash" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {unassigned > 0 && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-sand px-4 py-3 text-xs font-semibold text-[rgb(var(--amber-2))]">
              <Icon name="alert" size={15} className="shrink-0" />
              {inr(unassigned)} of this cycle’s card spend isn’t tied to a card number — those charges were flagged by hand or
              arrived without one. Open the transaction and set its card, or keep just one card registered.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DCE8B4] bg-sand px-4 py-3 text-sm">
            <span className="font-semibold">Bill generates on the</span>
            <Select
              value={String(statementDay)}
              options={Array.from({ length: MAX_STATEMENT_DAY }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }))}
              onChange={changeStatementDay}
              className="!w-auto min-w-[6rem]"
              width="8rem"
            />
            <span className="text-muted">of every month — each cycle runs from the day after through that day.</span>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-[#DCE8B4] bg-sand p-3 sm:flex-row">
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Last 4 digits"
              inputMode="numeric"
              className="input sm:w-40 tabular"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCard()}
              placeholder="Name (e.g. HDFC Regalia)"
              className="input flex-1"
            />
            <button onClick={addCard} disabled={busy || last4.length !== 4} className="btn-primary">
              {busy ? 'Adding…' : 'Add card'}
            </button>
          </div>
          {msg && <div className="text-xs text-credit">{msg}</div>}
        </section>
      </Reveal>

      {/* This cycle's charges */}
      <Reveal delay={40}>
        <section className="card p-4 sm:p-5">
          <div className="relative z-20 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[15px] font-bold">Card transactions · {cycle.label}</h2>
            <div className="flex items-center gap-2">
              <div className="flex-1 sm:w-64 sm:flex-none">
                <CategoryDropdown
                  categories={categories}
                  value={filter}
                  onChange={setFilter}
                  placeholder="All categories"
                  allowClear
                />
              </div>
              {filter.categoryId != null && (
                <button onClick={() => setFilter({ categoryId: null, subcategoryId: null })} className="btn-ghost shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 text-xs">
                  <Icon name="close" size={13} /> Clear
                </button>
              )}
            </div>
          </div>
          {filter.categoryId != null && shown.length > 0 && (
            <p className="mb-2 text-xs font-semibold text-muted">
              {shown.length} transaction{shown.length === 1 ? '' : 's'} · {inr(shownNet)} net
            </p>
          )}
          {loading ? (
            <p className="text-sm text-muted py-6 text-center">Loading…</p>
          ) : txns.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing on your cards this cycle. If charges are missing, check that the card’s last 4 digits are registered above.
            </p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted">No card transactions in this category this cycle.</p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="tile h-9 w-9 shrink-0 rounded-xl text-white" style={{ background: categoryStyle(t.categoryName, t.direction === 'debit').solid }}>
                    <Icon name={categoryStyle(t.categoryName, t.direction === 'debit').icon} size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-bold">{t.label}</div>
                    <div className="text-xs font-medium text-muted">
                      {fmtDate(t.occurredAt)}
                      {t.accountLast4 && <span className="font-mono"> · ••{t.accountLast4}</span>}
                      {t.categoryName && ` · ${t.categoryName}${t.subcategoryName ? ` › ${t.subcategoryName}` : ''}`}
                    </div>
                  </div>
                  <span className={`tabular font-extrabold ${t.direction === 'credit' ? 'text-credit' : 'text-debit'}`}>
                    {t.direction === 'credit' ? '+' : '−'}{inr(Number(t.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
      {paying && (
        <AddTransaction
          initialKind="cardBill"
          initialAmount={lastBill?.due || undefined}
          onAdded={reload}
          onClose={() => setPaying(false)}
        />
      )}
    </div>
  );
}
