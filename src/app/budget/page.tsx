'use client';

import { useCallback, useEffect, useState } from 'react';
import { inr } from '@/lib/format';
import { useCategories } from '@/lib/useCategories';
import Reveal from '@/components/Reveal';
import { CategoryDropdown } from '@/components/Select';
import { categoryColor } from '@/lib/palette';

interface B {
  budgetId: number;
  categoryId: number;
  categoryName: string;
  budget: number;
  spent: number;
}

function barColor(pct: number) {
  if (pct >= 100) return 'bg-debit';
  if (pct >= 80) return 'bg-[#E8833A]';
  return 'bg-[rgb(var(--ink))]';
}

export default function BudgetPage() {
  const categories = useCategories();
  const [budgets, setBudgets] = useState<B[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch('/api/budgets').then((r) => r.json());
    setBudgets(d.budgets ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(catId: number, amt: number) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: catId, amount: amt }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!categoryId || !amount || Number(amount) <= 0) {
      setMsg('Pick a category and enter an amount.');
      return;
    }
    await save(Number(categoryId), Number(amount));
    setAmount('');
    setCategoryId('');
  }

  const totalBudget = budgets.reduce((s, b) => s + b.budget, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  // categories without a budget yet (top-level, expense-ish)
  const budgetedIds = new Set(budgets.map((b) => b.categoryId));
  const available = categories.filter((c) => !budgetedIds.has(c.id));

  // How far through the month we are — the pace marker on each bar.
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pace = Math.round((now.getDate() / daysInMonth) * 100);
  const over = budgets.filter((b) => b.spent > b.budget).length;
  const left = totalBudget - totalSpent;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">
            {now.toLocaleDateString('en-IN', { month: 'long' })} · day {now.getDate()} of {daysInMonth}
          </div>
          <h1 className="h-page mt-1.5">Budgets</h1>
        </div>
        <a href="#add-budget" className="btn-accent self-start px-4 sm:self-auto">
          + New budget
        </a>
      </header>

      {/* Summary */}
      <Reveal className="card-hero flex flex-wrap items-center gap-6 p-5 sm:p-6">
        <div className="min-w-[220px] flex-1">
          <div className="eyebrow !text-[rgb(var(--sidebar-muted))]">Spent of {inr(totalBudget)} budgeted</div>
          <div className="mt-2 font-display text-[clamp(2.5rem,6vw,3.5rem)] font-extrabold leading-none tabular">{inr(totalSpent)}</div>
        </div>
        <div className="flex min-w-[260px] flex-[2] flex-col gap-2.5">
          <div className="h-3.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${left < 0 ? 'bg-[#F2A46B]' : 'bg-amber'}`}
              style={{ width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-[13px] text-[rgb(var(--sidebar-muted))]">
            <span>
              <b className="text-white">{inr(Math.abs(left))}</b> {left >= 0 ? 'left' : 'over'}
            </span>
            <span>
              {over} over · {budgets.length - over} on track
            </span>
            <span>Transfers and card bills excluded</span>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
        {budgets.map((b, i) => {
          const pct = b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0;
          const isOver = pct >= 100;
          return (
            <Reveal key={b.budgetId} className={`card flex flex-col gap-3.5 p-5`} delay={i * 40}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: categoryColor(b.categoryName) }} />
                  <h2 className="h-section truncate">{b.categoryName}</h2>
                </span>
                <span className={`chip shrink-0 ${isOver ? 'bg-blush text-[#8A3109]' : pct > pace ? 'bg-sand text-[rgb(var(--amber-2))]' : 'bg-surface-2 text-text'}`}>
                  {isOver ? `Over by ${inr(b.spent - b.budget)}` : pct > pace ? 'Ahead of pace' : 'On track'}
                </span>
              </div>
              <div className="tabular text-xl font-semibold">
                {inr(b.spent)} <span className="text-sm text-muted">/ {inr(b.budget)}</span>
              </div>
              <div className="relative h-3 rounded-full bg-surface-2">
                <div className={`absolute inset-y-0 left-0 rounded-full ${barColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                {/* Where spending "should" be by today. */}
                <span className="absolute -bottom-1 -top-1 w-0.5 rounded-sm bg-[rgb(var(--ink))]" style={{ left: `${pace}%` }} title={`Day ${now.getDate()} pace`} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {pct}% used{isOver ? '' : ` · ${inr(Math.max(0, b.budget - b.spent))} left`}
                </span>
                <span className="flex items-center gap-1">
                  <BudgetEdit current={b.budget} onSave={(amt) => save(b.categoryId, amt)} />
                  <button onClick={() => save(b.categoryId, 0)} className="btn-ghost px-3 py-1.5 text-xs hover:text-debit">
                    Remove
                  </button>
                </span>
              </div>
            </Reveal>
          );
        })}

        {/* Add a budget — the last card in the grid */}
        <section id="add-budget" className="relative z-30 flex scroll-mt-6 flex-col gap-3 rounded-[20px] border border-dashed border-muted-soft p-5">
          <h2 className="h-section">{budgets.length ? 'Add a budget' : 'Set your first budget'}</h2>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Category</label>
            <CategoryDropdown
              categories={available}
              value={{ categoryId: categoryId ? Number(categoryId) : null, subcategoryId: null }}
              onChange={(v) => setCategoryId(v.categoryId ? String(v.categoryId) : '')}
              placeholder="Pick a category"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Monthly cap (₹)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} inputMode="decimal" placeholder="e.g. 15000" className="input tabular" />
          </div>
          <button onClick={add} disabled={busy} className="btn-primary">Add budget</button>
          {msg && <div className="text-xs text-debit">{msg}</div>}
        </section>
      </div>
    </div>
  );
}

function BudgetEdit({ current, onSave }: { current: number; onSave: (amt: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(current));
  if (!editing) {
    return (
      <button onClick={() => { setVal(String(current)); setEditing(true); }} className="btn-ghost px-3 py-1.5 text-xs hover:text-text">
        Edit
      </button>
    );
  }
  return (
    // min-w-0 + a flexible input so the field shrinks with the row instead of
    // forcing it wider than the card on a narrow phone.
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { onSave(Number(val) || 0); setEditing(false); } }}
        inputMode="decimal"
        autoFocus
        aria-label="Monthly budget"
        className="input min-w-0 flex-1 px-3 py-1.5 text-xs tabular xs:w-24 xs:flex-none"
      />
      <button onClick={() => { onSave(Number(val) || 0); setEditing(false); }} className="btn-primary shrink-0 px-3 py-1.5 text-xs">
        Save
      </button>
    </span>
  );
}
