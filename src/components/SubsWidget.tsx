'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { inr, fmtDate } from '@/lib/format';
import Icon from './Icon';

interface Sub {
  id: number;
  merchant: string;
  medianAmount: string;
  cadence: string;
  nextExpected: string;
  status: string;
}

export default function SubsWidget() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [monthly, setMonthly] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/subscriptions')
      .then((r) => (r.ok ? r.json() : { subscriptions: [], normalizedMonthlyTotal: 0 }))
      .then((d) => {
        setSubs(d.subscriptions ?? []);
        setMonthly(d.normalizedMonthlyTotal ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = subs.filter((s) => s.status === 'active' || s.status === 'price_changed').slice(0, 4);

  return (
    <section className="card lift p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Recurring</h2>
        <Link href="/subscriptions" className="text-xs font-semibold text-accent hover:underline">
          Manage →
        </Link>
      </div>
      {/* Headline panel, in the app's ink gradient rather than a washed-out
          grey box with a hairline border. */}
      <div className="card-hero mb-3 flex items-center gap-3 p-4">
        <span className="tile h-10 w-10 shrink-0 bg-white/15 text-white"><Icon name="repeat" size={18} /></span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Normalized monthly</div>
          <div className="text-2xl font-extrabold leading-tight tabular">{inr(monthly)}</div>
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : active.length === 0 ? (
        <div className="text-sm text-muted">None detected yet. Run “Re-detect” on the Subs page.</div>
      ) : (
        <ul className="divide-y divide-border">
          {active.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="tile h-9 w-9 shrink-0 rounded-xl bg-lilac text-[rgb(var(--peri-2))]">
                <Icon name="repeat" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{s.merchant}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <span className="capitalize">{s.cadence}</span>
                  <span className="text-muted-soft">·</span>
                  <Icon name="calendar" size={11} />
                  <span>next {fmtDate(s.nextExpected)}</span>
                </div>
              </div>
              <div className="tabular font-extrabold">{inr(s.medianAmount)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
