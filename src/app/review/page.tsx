'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inr, fmtDateTime } from '@/lib/format';
import { useCategories, categoriesForSide } from '@/lib/useCategories';
import CategoryEditor from '@/components/CategoryEditor';
import CategoryPicker from '@/components/CategoryPicker';
import Select, { monthOpts } from '@/components/Select';
import Icon from '@/components/Icon';
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
  llmConfidence: number | null;
}



export default function ReviewPage() {
  const categories = useCategories();
  const [queue, setQueue] = useState<Txn[]>([]);
  const [idx, setIdx] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [pendingCat, setPendingCat] = useState<number | null>(null); // category id whose subs are being shown
  const [flash, setFlash] = useState<string | null>(null);
  // Which side of the taxonomy the picker is showing. Follows the transaction's
  // direction by default — a credit is almost always income.
  const [side, setSide] = useState<'expense' | 'income'>('expense');

  // Opens on "All months" so the page always matches the sidebar's Inbox
  // count, which covers every uncategorised payment. Pick a month to work
  // through one month's backlog at a time.
  const months = useMemo(() => [{ value: 'all', label: 'All months', icon: 'calendar' }, ...monthOpts(12)], []);
  const [month, setMonth] = useState('all');

  const load = useCallback(async (m: string) => {
    setLoading(true);
    let range = '';
    if (m !== 'all') {
      const [y, mo] = m.split('-').map(Number);
      const last = new Date(y, mo, 0).getDate();
      range = `&from=${m}-01&to=${m}-${String(last).padStart(2, '0')}`;
    }
    const res = await fetch(`/api/transactions?reviewQueue=1&pageSize=200${range}`);
    const data = await res.json();
    setQueue(data.items);
    setTotal(data.items.length);
    setIdx(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(month);
  }, [load, month]);

  const current = queue[idx];

  // Follow the current transaction's direction when it changes.
  useEffect(() => {
    if (current) setSide(current.direction === 'credit' ? 'income' : 'expense');
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = categoriesForSide(categories, side);

  const assign = useCallback(
    async (categoryId: number, subcategoryId?: number | null) => {
      if (!current) return;
      const cat = categories.find((c) => c.id === categoryId);
      const sub = cat?.subcategories.find((s) => s.id === subcategoryId);
      await fetch(`/api/transactions/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'always', categoryId, subcategoryId: subcategoryId ?? null, reapply: true }),
      });
      // Lets the sidebar's Inbox count drop right away.
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      setFlash(`${current.label} → ${cat?.name}${sub ? ' › ' + sub.name : ''}`);
      setPendingCat(null);
      setIdx((i) => i + 1);
    },
    [current, categories],
  );

  const skip = useCallback(() => { setPendingCat(null); setIdx((i) => i + 1); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing || !current) return;
      // Subcategory step: 1-9 picks a sub, Enter/0 saves just the category, Esc backs out.
      if (pendingCat != null) {
        const cat = categories.find((c) => c.id === pendingCat);
        if (!cat) return;
        if (e.key >= '1' && e.key <= '9') {
          const n = Number(e.key) - 1;
          if (cat.subcategories[n]) assign(cat.id, cat.subcategories[n].id);
        } else if (e.key === 'Enter' || e.key === '0') assign(cat.id);
        else if (e.key === 'Escape') setPendingCat(null);
        return;
      }
      if (e.key >= '1' && e.key <= '9') {
        const n = Number(e.key) - 1;
        const c = visible[n];
        if (c) (c.subcategories.length > 0 ? setPendingCat(c.id) : assign(c.id));
      } else if (e.key.toLowerCase() === 'e') setEditing(true);
      else if (e.key.toLowerCase() === 's') skip();
      else if (e.key.toLowerCase() === 'i') setSide('income');
      else if (e.key.toLowerCase() === 'x') setSide('expense');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, editing, pendingCat, categories, visible, assign, skip]);

  if (loading) return <div className="text-muted py-16 text-center animate-fade-in">Loading…</div>;

  const remaining = queue.length - idx;
  const donePct = total > 0 ? Math.round((idx / total) * 100) : 0;

  const upNext = queue.slice(idx, idx + 7);
  const kbd = 'rounded-md border border-border bg-surface px-1.5 font-mono text-[11px] text-muted';

  return (
    <div className="space-y-4">
      <header className="relative z-30 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="eyebrow">
            {remaining} left · {months.find((m) => m.value === month)?.label}
          </div>
          <h1 className="h-page mt-1.5">Inbox</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-xs text-muted xl:inline">
            <kbd className={kbd}>1</kbd>–<kbd className={kbd}>9</kbd> pick · <kbd className={kbd}>s</kbd> skip · <kbd className={kbd}>e</kbd> just this one
          </span>
          <Select value={month} options={months} onChange={setMonth} align="right" className="!w-auto min-w-0 flex-1 sm:min-w-[11rem] sm:flex-none" />
          <button onClick={() => load(month)} className="btn-outline shrink-0 px-3">Refresh</button>
        </div>
      </header>

      {total > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-[rgb(var(--border))]" role="progressbar" aria-valuenow={donePct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[rgb(var(--ink))] transition-all duration-300" style={{ width: `${donePct}%` }} />
        </div>
      )}

      {flash && <div className="text-xs font-semibold text-credit animate-fade-in">✓ {flash}</div>}

      {!current ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center animate-pop">
          <span className="tile mb-1 h-14 w-14 bg-amber text-[rgb(var(--ink))]">
            <Icon name="check" size={26} />
          </span>
          <div className="font-display text-2xl font-extrabold">All caught up</div>
          <div className="text-sm text-muted">{month === 'all' ? 'Every payment has a category.' : 'Everything this month has a category.'}</div>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section key={current.id} className="card flex flex-col gap-5 p-5 animate-pop sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[rgb(var(--ink))] font-display text-2xl font-extrabold text-amber">
                  {current.label.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-display text-[clamp(1.375rem,3vw,2rem)] font-extrabold tracking-[-0.02em]">{current.label}</div>
                  <div className="tabular truncate text-xs text-muted">
                    {fmtDateTime(current.occurredAt)} · {current.instrument}
                    {current.llmConfidence != null ? ` · AI ${Math.round(current.llmConfidence * 100)}% sure` : ''}
                  </div>
                </div>
              </div>
              <div className={`shrink-0 font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold tabular ${current.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
                {current.direction === 'debit' ? '−' : '+'}
                {inr(current.amount)}
              </div>
            </div>
            <div className="truncate rounded-xl bg-surface-2 px-3.5 py-2.5 font-mono text-xs text-muted">{current.rawMerchant}</div>

            {editing ? (
              <CategoryEditor
                txnId={current.id}
                merchant={current.merchant}
                currentCategoryId={null}
                currentSubcategoryId={null}
                compact
                onDone={() => { setEditing(false); setIdx((i) => i + 1); window.dispatchEvent(new Event(DATA_CHANGED_EVENT)); }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="eyebrow">Pick a category</span>
                  {/* Expense / Income sides of the taxonomy */}
                  <div className="seg" role="group" aria-label="Side">
                    {(['expense', 'income'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => { setSide(v); setPendingCat(null); }}
                        className={`seg-btn min-h-9 capitalize ${side === v ? 'seg-on' : ''}`}
                      >
                        {v} <kbd className="ml-1 text-[10px] text-muted">{v === 'income' ? 'i' : 'x'}</kbd>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categories and their subcategories, all in view. */}
                <CategoryPicker
                  categories={categories}
                  side={side}
                  numbered
                  value={{ categoryId: pendingCat, subcategoryId: null }}
                  onChange={(p) => p.categoryId != null && assign(p.categoryId, p.subcategoryId)}
                  columns="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                />

                {pendingCat != null && (
                  <p className="text-xs font-semibold text-muted">Pick a subcategory with 1–9, press Enter to file under the category alone, or Esc to back out.</p>
                )}

                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Choosing a category writes a rule for this merchant. */}
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <Icon name="sparkle" size={13} className="shrink-0" />
                    Also files <span className="font-semibold text-text">{current.merchant}</span> here from now on.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(true)} className="btn-outline px-3" title="Categorise this one without creating a rule">
                      Just this one
                    </button>
                    <button onClick={skip} className="btn-outline px-4">
                      Skip
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="card hidden p-2 lg:block" aria-label="Queue">
            <div className="eyebrow px-3 pb-1 pt-2">Up next</div>
            <ul>
              {upNext.map((q, i) => (
                <li key={q.id}>
                  <button
                    onClick={() => { setIdx(idx + i); setEditing(false); setPendingCat(null); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === 0 ? 'bg-sand' : 'hover:bg-surface-2'}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${i === 0 ? 'bg-[rgb(var(--ink))] text-amber' : 'bg-surface-2 text-muted'}`}>
                      {q.label.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{q.label}</span>
                      <span className="tabular text-xs text-muted">{fmtDateTime(q.occurredAt).split(',')[0]}</span>
                    </span>
                    <span className={`tabular text-sm ${q.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
                      {q.direction === 'debit' ? '−' : '+'}
                      {inr(q.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {remaining > upNext.length && <div className="px-3 py-2 text-xs text-muted">+ {remaining - upNext.length} more</div>}
          </aside>
        </div>
      )}
    </div>
  );
}
