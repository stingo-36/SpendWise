'use client';

import CategoryTile from './CategoryTile';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { inr, fmtDate } from '@/lib/format';

interface Txn {
  id: number;
  occurredAt: string;
  amount: string;
  direction: 'debit' | 'credit';
  merchant: string;
  label: string;
  categoryName: string | null;
  categoryIcon?: string | null;
  subcategoryName?: string | null;
  subcategoryIcon?: string | null;
}

/** Last day of a YYYY-MM month, as YYYY-MM-DD. */
function monthEnd(month: string): string {
  const [y, mo] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}`;
}

/**
 * Recent activity for ONE month. Scoped to the dashboard's selected month so a
 * new month starts empty instead of trailing the previous month's rows.
 */
export default function RecentTransactions({ month }: { month: string }) {
  const [items, setItems] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/transactions?pageSize=6&from=${month}-01&to=${monthEnd(month)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h2 className="h-section">Recent activity</h2>
        <Link href="/transactions" className="text-xs font-semibold text-[rgb(var(--peri))] hover:underline">
          View all →
        </Link>
      </div>
      {loading ? (
        <div className="px-5 pb-5 text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-muted">Nothing this month yet.</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t) => {
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/50">
                <CategoryTile
                  categoryName={t.categoryName}
                  categoryIcon={t.categoryIcon}
                  subcategoryName={t.subcategoryName}
                  subcategoryIcon={t.subcategoryIcon}
                  isExpense={t.direction === 'debit'}
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.label}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {fmtDate(t.occurredAt)} · {t.categoryName ? `${t.categoryName}${t.subcategoryName ? ` › ${t.subcategoryName}` : ''}` : 'Needs category'}
                  </div>
                </div>
                <div className={`shrink-0 text-sm font-semibold tabular ${t.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
                  {t.direction === 'debit' ? '−' : '+'}
                  {inr(t.amount)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
