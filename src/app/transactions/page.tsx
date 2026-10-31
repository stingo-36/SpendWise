'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inr } from '@/lib/format';
import { useCategories } from '@/lib/useCategories';
import CategoryEditor from '@/components/CategoryEditor';
import AddTransaction from '@/components/AddTransaction';
import Icon from '@/components/Icon';
import Select, { CategoryDropdown } from '@/components/Select';
import { categoryStyle } from '@/lib/palette';
import CategoryTag from '@/components/CategoryTag';
import { DATA_CHANGED_EVENT } from '@/lib/navLinks';

interface Txn {
  id: number;
  occurredAt: string;
  amount: string;
  direction: 'debit' | 'credit';
  merchant: string;
  label: string;
  rawMerchant: string;
  instrument: string;
  accountLast4: string | null;
  categoryId: number | null;
  categoryName: string | null;
  subcategoryId: number | null;
  subcategoryName: string | null;
  categorySource: string;
  categoryLocked: boolean;
  llmConfidence: number | null;
  isRecurring: boolean;
  isCreditCard: boolean;
}

interface DeletedTxn {
  id: number;
  occurredAt: string;
  amount: string;
  direction: 'debit' | 'credit';
  merchant: string;
  label: string;
  instrument: string;
  accountLast4: string | null;
  deletedAt: string;
}

// All formatting is pinned to IST so grouping and headings never disagree
// (bank times are IST; the server/browser timezone must not split a day).
const IST = 'Asia/Kolkata';
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: IST }); // YYYY-MM-DD
}
function dayHeading(iso: string): string {
  const key = dayKey(iso);
  const now = new Date();
  const todayKey = now.toLocaleDateString('en-CA', { timeZone: IST });
  const yKey = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: IST });
  const base = new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  if (key === todayKey) return `Today · ${base}`;
  if (key === yKey) return `Yesterday · ${base}`;
  return base;
}
/** "Today" / "Yesterday" / "Monday", and the date beside it. */
function dayParts(iso: string): { lead: string; date: string } {
  const key = dayKey(iso);
  const now = new Date();
  const todayKey = now.toLocaleDateString('en-CA', { timeZone: IST });
  const yKey = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: IST });
  const d = new Date(iso);
  const sameYear = d.toLocaleDateString('en-CA', { timeZone: IST, year: 'numeric' }) === now.toLocaleDateString('en-CA', { timeZone: IST, year: 'numeric' });
  const date = d.toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  const weekday = d.toLocaleDateString('en-IN', { timeZone: IST, weekday: 'long' });
  if (key === todayKey) return { lead: 'Today', date: `${weekday}, ${date}` };
  if (key === yKey) return { lead: 'Yesterday', date: `${weekday}, ${date}` };
  return { lead: weekday, date };
}
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit' });
}

export default function TransactionsPage() {
  const categories = useCategories();
  const [items, setItems] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // Deleted transactions live behind their own toggle on this page: they are
  // tombstoned (never re-imported by a sync) until restored.
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleted, setDeleted] = useState<DeletedTxn[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  // A failed delete/restore used to do nothing at all — always say why.
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletedError, setDeletedError] = useState<string | null>(null);

  // Default to the current month (a new month starts fresh); "All time" clears it.
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  // filters
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [direction, setDirection] = useState('');
  // '' = everything, 'bank' = account money only, 'card' = credit-card charges only.
  const [source, setSource] = useState('');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: '100' });
    if (merchant) p.set('merchant', merchant);
    if (categoryId) p.set('categoryId', categoryId);
    if (subcategoryId) p.set('subcategoryId', subcategoryId);
    if (direction) p.set('direction', direction);
    if (source) p.set('creditCard', source === 'card' ? '1' : '0');
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    const res = await fetch(`/api/transactions?${p}`);
    const data = await res.json();
    setItems(data.items);
    setTotal(data.total);
    setLoading(false);
  }, [page, merchant, categoryId, subcategoryId, direction, source, from, to]);

  const loadDeleted = useCallback(async () => {
    setDeletedLoading(true);
    try {
      const res = await fetch('/api/transactions/deleted');
      // A 5xx returns an HTML error page — parsing it as JSON throws, and
      // without the finally below the panel would sit on "Loading…" forever.
      if (!res.ok) {
        const msg = await res
          .json()
          .then((d) => d.error as string | undefined)
          .catch(() => null);
        setDeletedError(msg || `Couldn't load deleted transactions (${res.status})`);
        setDeleted([]);
        return;
      }
      const data = await res.json();
      setDeleted(data.items ?? []);
      setDeletedError(null);
    } catch {
      setDeletedError("Couldn't reach the server.");
      setDeleted([]);
    } finally {
      setDeletedLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The tab bar's + button adds transactions without going through this page.
  useEffect(() => {
    window.addEventListener(DATA_CHANGED_EVENT, load);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, load);
  }, [load]);

  useEffect(() => {
    loadDeleted();
  }, [loadDeleted]);

  /** Read the server's error message; a 5xx returns HTML, so don't let JSON parsing throw. */
  async function errorFrom(res: Response, fallback: string) {
    const msg = await res
      .json()
      .then((d) => d.error as string | undefined)
      .catch(() => null);
    return msg || `${fallback} (${res.status})`;
  }

  async function remove(t: Txn) {
    if (!confirm(`Delete "${t.label}" (${inr(t.amount)})?\n\nIt won't come back on the next sync. You can restore it from "Deleted transactions".`)) return;
    setActionError(null);
    const res = await fetch(`/api/transactions/${t.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setActionError(await errorFrom(res, 'Delete failed'));
      return;
    }
    if (editing === t.id) setEditing(null);
    await Promise.all([load(), loadDeleted()]);
  }

  async function restore(d: DeletedTxn) {
    setActionError(null);
    const res = await fetch(`/api/transactions/deleted/${d.id}`, { method: 'POST' });
    if (!res.ok) {
      setActionError(await errorFrom(res, 'Restore failed'));
      return;
    }
    await Promise.all([load(), loadDeleted()]);
  }

  async function forget(d: DeletedTxn) {
    if (!confirm(`Forget "${d.label}" permanently?\n\nThe tombstone is removed, so a future sync may import it again.`)) return;
    setActionError(null);
    const res = await fetch(`/api/transactions/deleted/${d.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setActionError(await errorFrom(res, 'Could not forget'));
      return;
    }
    await loadDeleted();
  }

  async function setCreditCard(t: Txn, isCreditCard: boolean) {
    // Optimistic — the row's totals recompute immediately.
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, isCreditCard } : x)));
    const res = await fetch(`/api/transactions/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCreditCard }),
    });
    if (!res.ok) await load(); // roll back to server truth
  }

  // Group by day (API already returns newest-first).
  const groups = useMemo(() => {
    const m = new Map<string, Txn[]>();
    for (const t of items) {
      const k = dayKey(t.occurredAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return Array.from(m.entries()).map(([key, list]) => {
      // Card charges don't move the account balance — the bill payment does.
      let net = 0;
      for (const t of list) {
        if (t.isCreditCard) continue;
        net += (t.direction === 'credit' ? 1 : -1) * Number(t.amount);
      }
      return { key, iso: list[0].occurredAt, list, net };
    });
  }, [items]);

  const pages = Math.max(1, Math.ceil(total / 100));

  return (
    <div className="space-y-4">
      <header className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="h-page">Activity</h1>
          <p className="text-sm text-muted">{total} shown · newest first</p>
        </div>
        {/* Wraps on phones: four controls on one 343px row left each of them
            squeezed against the gutter. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg">
            <button onClick={() => { setPage(1); setFrom(monthStart); setTo(''); }} className={`seg-btn ${from === monthStart && !to ? 'seg-on' : ''}`}>This month</button>
            <button onClick={() => { setPage(1); setFrom(''); setTo(''); }} className={`seg-btn ${!from ? 'seg-on' : ''}`}>All time</button>
          </div>
          <button
            onClick={() => {
              setShowDeleted(true);
              loadDeleted();
              // Jump to the section rather than making them scroll the whole list.
              // Two frames: the panel has to render before it can be scrolled to.
              requestAnimationFrame(() =>
                requestAnimationFrame(() =>
                  document.getElementById('deleted')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                ),
              );
            }}
            className="btn-outline flex-1 gap-1.5 whitespace-nowrap px-3 py-2 sm:flex-none"
            title="Transactions you've deleted — restore them from here"
          >
            Deleted
            {deleted.length > 0 && (
              <span className="rounded-full bg-surface-2 px-1.5 text-xs font-bold text-muted">{deleted.length}</span>
            )}
          </button>
          <button onClick={() => setAdding(true)} className="btn-primary flex-1 px-4 py-2 sm:flex-none">
            <Icon name="plus" size={16} /> Add
          </button>
        </div>
      </header>

      {actionError && (
        <div className="flex items-center gap-2 rounded-2xl bg-blush px-4 py-3 text-sm font-semibold text-[rgb(var(--debit))]">
          <Icon name="alert" size={16} className="shrink-0" /> {actionError}
        </div>
      )}

      {/* Filters */}
      {/* Filters — one row, everything on the same baseline including the
          reset link, which used to wrap onto a line of its own. */}
      <div className="card p-3 sm:p-4 animate-fade-up relative z-30" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative lg:min-w-[220px] lg:flex-1">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input placeholder="Search merchant…" value={merchant} onChange={(e) => { setPage(1); setMerchant(e.target.value); }} className="input pl-9" />
          </div>
          <div className="lg:w-52">
            <CategoryDropdown
              categories={categories}
              value={{ categoryId: categoryId ? Number(categoryId) : null, subcategoryId: subcategoryId ? Number(subcategoryId) : null }}
              onChange={(v) => {
                setPage(1);
                setCategoryId(v.categoryId ? String(v.categoryId) : '');
                setSubcategoryId(v.subcategoryId ? String(v.subcategoryId) : '');
              }}
              placeholder="All categories"
              allowClear
            />
          </div>
          <div className="lg:w-52">
            <Select
              value={direction}
              onChange={(v) => { setPage(1); setDirection(v); }}
              placeholder="Income & expense"
              options={[
                { value: '', label: 'Income & expense', icon: 'transfers' },
                { value: 'debit', label: 'Expense only', icon: 'wallet', tone: '#D6584E' },
                { value: 'credit', label: 'Income only', icon: 'income', tone: '#2A8A69' },
              ]}
            />
          </div>
          <div className="lg:w-48">
            <Select
              value={source}
              onChange={(v) => { setPage(1); setSource(v); }}
              placeholder="Bank & card"
              options={[
                { value: '', label: 'Bank & card', icon: 'wallet' },
                { value: 'bank', label: 'Bank account only', icon: 'wallet', tone: '#3D7FC1' },
                { value: 'card', label: 'Credit card only', icon: 'creditcard', tone: '#E0813C' },
              ]}
            />
          </div>
          {/* Two date fields side by side leave ~140px each below 360px, and
              a native date input clips its own value at that width — the
              picker glyph is drawn inside the box. Stack them until there is
              room, and trim the padding the glyph would otherwise eat. */}
          <div className="grid grid-cols-1 gap-2.5 xs:grid-cols-2 lg:flex lg:flex-none">
            <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className="input px-3 lg:w-[9.5rem]" aria-label="From date" />
            <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className="input px-3 lg:w-[9.5rem]" aria-label="To date" />
          </div>
          {(merchant || categoryId || direction || source || from || to) && (
            <button
              onClick={() => { setPage(1); setMerchant(''); setCategoryId(''); setSubcategoryId(''); setDirection(''); setSource(''); setFrom(''); setTo(''); }}
              className="btn-ghost shrink-0 gap-1.5 whitespace-nowrap px-3 py-2 text-xs"
            >
              <Icon name="close" size={13} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-muted py-8 text-center">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="text-muted py-8 text-center">No transactions match.</div>
      ) : (
        <div>
          {groups.map((g, gi) => {
            const day = dayParts(g.iso);
            const last = gi === groups.length - 1;
            return (
              <section key={g.key} aria-label={dayHeading(g.iso)} className="relative pb-5 pl-8 sm:pl-10">
                {/* Timeline: a rail down the left with a dot for each day. */}
                {!last && <span aria-hidden className="absolute bottom-0 left-[7px] top-4 w-0.5 rounded-full bg-[rgb(var(--border))] sm:left-[11px]" />}
                <span aria-hidden className="absolute left-0.5 top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-[rgb(var(--bg))] bg-[rgb(var(--ink))] sm:left-1.5" />

                <div data-animate className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                  <h2 className="font-display text-lg font-bold">{day.lead}</h2>
                  <span className="text-sm font-medium text-text">{day.date}</span>
                  <span className="ml-auto text-right text-xs text-muted">
                    {g.list.length} {g.list.length === 1 ? 'payment' : 'payments'} ·{' '}
                    <span className={`tabular font-semibold ${g.net >= 0 ? 'text-credit' : 'text-debit'}`}>
                      {g.net >= 0 ? '+' : '−'}
                      {inr(Math.abs(g.net))}
                    </span>
                  </span>
                </div>

                <ul className="flex flex-col">
                  {g.list.map((t) => {
                    const st = categoryStyle(t.categoryName, t.direction === 'debit');
                    const isEditing = editing === t.id;
                    return (
                      <li key={t.id} data-animate className={`group -mx-3 rounded-2xl transition-colors ${isEditing ? 'bg-surface-2' : 'hover:bg-surface-2/70'}`}>
                        <div className="flex items-center gap-3.5 px-3 py-3">
                          <span
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                            style={{ background: t.categoryId ? st.soft : 'rgb(var(--surface-2))', color: t.categoryId ? st.ink : 'rgb(var(--muted))' }}
                          >
                            <Icon name={t.categoryId ? st.icon : 'other'} size={19} />
                          </span>

                          {/* Name, then tags and meta underneath — a list item, not table columns. */}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-semibold">{t.label}</div>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                              <CategoryTag category={t.categoryName} subcategory={t.subcategoryName} isExpense={t.direction === 'debit'} locked={t.categoryLocked} />
                              {t.isCreditCard && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-[rgb(var(--ink))] px-2 py-0.5 font-semibold text-amber">
                                  <Icon name="creditcard" size={12} /> Card
                                </span>
                              )}
                              {!t.isCreditCard && t.direction === 'debit' && t.subcategoryName === 'Credit card bill' && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-sky px-2 py-0.5 font-semibold text-[rgb(var(--peri-2))]">
                                  <Icon name="check" size={12} /> Bill paid
                                </span>
                              )}
                              {t.isRecurring && (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-0.5 font-semibold">
                                  <Icon name="repeat" size={12} /> Recurring
                                </span>
                              )}
                              <span className="whitespace-nowrap">
                                <span className="tabular">{timeOf(t.occurredAt)}</span> · <span className="capitalize">{t.instrument}</span>
                                {t.accountLast4 && <span className="tabular"> ··{t.accountLast4}</span>}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <div className={`text-right text-[15px] font-semibold tabular ${t.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
                              {t.direction === 'debit' ? '−' : '+'}
                              {inr(t.amount)}
                            </div>
                            {/* Edit and delete, always visible. */}
                            <div className="ml-1 flex items-center gap-1">
                              <button
                                onClick={() => setEditing(isEditing ? null : t.id)}
                                className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${isEditing ? 'bg-[rgb(var(--ink))] text-white' : 'bg-surface-2 text-text hover:bg-[rgb(var(--border))]'}`}
                                aria-label={isEditing ? `Close editor for ${t.label}` : `Edit ${t.label}`}
                                title={isEditing ? 'Close' : 'Edit'}
                              >
                                <Icon name={isEditing ? 'close' : 'edit'} size={15} />
                              </button>
                              <button
                                onClick={() => remove(t)}
                                className="grid h-8 w-8 place-items-center rounded-lg bg-[#FBE3D3] text-[#9A3412] transition-colors hover:bg-debit hover:text-white"
                                aria-label={`Delete ${t.label}`}
                                title="Delete"
                              >
                                <Icon name="trash" size={15} />
                              </button>
                            </div>
                          </div>
                        </div>

                    {editing === t.id && (
                      <div className="space-y-3 px-3 pb-4 sm:pl-[61px]">
                        <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={t.isCreditCard}
                            onChange={(e) => setCreditCard(t, e.target.checked)}
                          />
                          <span>
                            {t.direction === 'debit' ? 'Charged to a credit card' : 'Refunded to a credit card'}
                            <span className="block text-xs text-muted">
                              {t.direction === 'debit'
                                ? 'Counts as spend, but isn’t deducted from your account balance.'
                                : 'Money returned to the card — not income, so it’s left out of “Money in”.'}
                            </span>
                          </span>
                        </label>
                        <CategoryEditor
                          txnId={t.id}
                          merchant={t.merchant}
                          currentCategoryId={t.categoryId}
                          currentSubcategoryId={t.subcategoryId}
                          onDone={() => { setEditing(null); load(); window.dispatchEvent(new Event(DATA_CHANGED_EVENT)); }}
                          onCancel={() => setEditing(null)}
                        />
                      </div>
                    )}
                      </li>
                    );
                  })}
                </ul>
                {/* Dotted divider closing each day. */}
                {!last && <div aria-hidden className="mt-4 border-t-2 border-dotted border-[rgb(var(--border))]" />}
              </section>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-outline px-4 py-1.5 text-sm">← Prev</button>
          <span className="text-sm font-semibold text-muted tabular">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-outline px-4 py-1.5 text-sm">Next →</button>
        </div>
      )}

      {/* ── Deleted ─────────────────────────────────────────────────────── */}
      <section id="deleted" className="scroll-mt-20 pt-2">
        <button
          onClick={() => setShowDeleted((v) => !v)}
          className="flex w-full items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm font-semibold transition-colors hover:border-[rgb(var(--text))]/40"
        >
          <Icon name="chevron" size={15} className={`text-muted transition-transform duration-200 ${showDeleted ? 'rotate-90' : ''}`} />
          Deleted transactions
          {deleted.length > 0 && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">{deleted.length}</span>
          )}
          <span className="ml-auto text-xs font-normal text-muted">
            {showDeleted ? 'Hide' : 'Show'}
          </span>
        </button>

        {showDeleted && (
          <div className="mt-2.5 space-y-2.5">
            <p className="px-1 text-xs text-muted">
              These stay out of your totals and are never re-imported by a sync. Restore one to bring it back.
            </p>

            {deletedLoading ? (
              <div className="py-6 text-center text-sm text-muted">Loading…</div>
            ) : deletedError ? (
              <div className="rounded-2xl bg-blush px-4 py-3 text-sm font-medium text-[rgb(var(--debit))]">
                {deletedError}
                <button onClick={loadDeleted} className="ml-2 underline">Retry</button>
              </div>
            ) : deleted.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted">
                Nothing deleted yet.
              </div>
            ) : (
              deleted.map((d) => (
                <div key={d.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-muted line-through">{d.label}</span>
                      <span className="shrink-0 text-sm font-bold tabular text-muted line-through">
                        {d.direction === 'debit' ? '−' : '+'}{inr(d.amount)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {dayHeading(d.occurredAt)} · {timeOf(d.occurredAt)}
                      {d.instrument !== 'unknown' ? ` · ${d.instrument}` : ''}
                      {d.accountLast4 ? ` · ••${d.accountLast4}` : ''}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted/70">
                      Deleted {dayHeading(d.deletedAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => restore(d)} className="btn-outline gap-1.5 px-3 py-1.5 text-xs">
                      <Icon name="restore" size={13} /> Restore
                    </button>
                    <button onClick={() => forget(d)} className="btn-ghost gap-1.5 px-3 py-1.5 text-xs hover:text-debit">
                      <Icon name="trash" size={13} /> Forget
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {adding && <AddTransaction onAdded={load} onClose={() => setAdding(false)} />}
    </div>
  );
}
