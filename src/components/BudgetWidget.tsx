'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { inr } from '@/lib/format';

interface B {
  budgetId: number;
  categoryId: number;
  categoryName: string;
  budget: number;
  spent: number;
}

function barColor(pct: number) {
  if (pct >= 100) return 'bg-debit';
  if (pct >= 80) return 'bg-amber';
  return 'bg-credit';
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
    <section className="card lift p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Budgets</h2>
        <Link href="/budget" className="text-xs text-accent">Manage →</Link>
      </div>
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : budgets.length === 0 ? (
        <div className="text-sm text-muted">
          No budgets yet. <Link href="/budget" className="text-accent">Set one →</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {budgets.slice(0, 5).map((b) => {
            const pct = b.budget > 0 ? Math.round((b.spent / b.budget) * 100) : 0;
            return (
              <li key={b.budgetId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{b.categoryName}</span>
                  <span className="tabular text-muted">
                    {inr(b.spent)} <span className="text-muted/60">/ {inr(b.budget)}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {pct >= 100 && <div className="mt-0.5 text-[11px] text-debit">Over by {inr(b.spent - b.budget)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
