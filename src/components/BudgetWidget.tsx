'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';
import Icon from './Icon';

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

export default function BudgetWidget({ month }: { month: string }) {
  const [budgets, setBudgets] = useState<B[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/budgets?month=${month}`)
      .then((r) => (r.ok ? r.json() : { budgets: [] }))
      .then((d) => setBudgets(d.budgets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="h-section">Budgets</h2>
        {budgets.length > 0 && (
          <Link href="/budget" className="text-xs font-semibold text-[rgb(var(--peri))] hover:underline">
            Manage →
          </Link>
        )}
      </div>
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : budgets.length === 0 ? (
        // Compact empty state: one line and a button, not a tall blank card.
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <span className="tile h-9 w-9 shrink-0 bg-surface text-muted">
            <Icon name="budget" size={17} />
          </span>
          <span className="min-w-0 flex-1 text-sm text-muted">Cap a category to see how close you are.</span>
          <Link href="/budget" className="btn-primary min-h-9 shrink-0 px-3 text-xs">
            Set one
          </Link>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {budgets.slice(0, 5).map((b) => {
            const pct = b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0;
            return (
              <li key={b.budgetId}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{b.categoryName}</span>
                  <span className={`shrink-0 tabular ${pct >= 100 ? 'text-debit' : 'text-muted'}`}>
                    {inr(b.spent)} <span className="text-muted-soft">/ {inr(b.budget)}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full transition-all ${barColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {pct >= 100 && <div className="mt-1 text-[11px] font-semibold text-debit">Over by {inr(b.spent - b.budget)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
