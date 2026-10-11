'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { inr, fmtDate } from '@/lib/format';
import Icon from './Icon';
import { categoryStyle } from '@/lib/palette';

interface Txn {
  id: number;
  occurredAt: string;
  amount: string;
  direction: 'debit' | 'credit';
  merchant: string;
  label: string;
  categoryName: string | null;
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
    <section className="card lift p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold">Recent activity</h2>
        <Link href="/transactions" className="text-xs font-semibold text-accent hover:underline">
          View all →
        </Link>
      </div>
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted">Nothing this month yet.</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t) => {
            // The category's own glyph and colour, matching the transactions
            // list and the charts — the bare ↑/↓ arrows said nothing about
            // what the money was for.
            const st = categoryStyle(t.categoryName, t.direction === 'debit');
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span
                  className="tile h-9 w-9 shrink-0 rounded-xl text-white"
                  style={{ background: t.categoryName ? st.solid : 'rgb(var(--muted-soft))' }}
                >
                  <Icon name={t.categoryName ? st.icon : 'other'} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{t.label}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <span>{fmtDate(t.occurredAt)}</span>
                    <span className="text-muted-soft">·</span>
                    <span style={t.categoryName ? { color: st.ink } : undefined}>{t.categoryName ?? 'Uncategorized'}</span>
                  </div>
                </div>
                <div className={`text-sm font-extrabold tabular ${t.direction === 'debit' ? 'text-debit' : 'text-credit'}`}>
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
