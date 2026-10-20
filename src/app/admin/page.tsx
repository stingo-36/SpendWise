'use client';

import { useEffect, useMemo, useState } from 'react';
import { inr, fmtDate, fmtDateTime } from '@/lib/format';
import Icon from '@/components/Icon';

interface AdminUser {
  id: number;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  transactions: number;
  lastTransactionAt: string | null;
  lastActivityAt: string | null;
  monthSpend: number;
  gmail: string | null;
  lastSyncStatus: string | null;
  budgets: number;
  activeThisWeek: boolean;
}
interface Totals { users: number; newThisMonth: number; activeThisWeek: number; transactions: number; gmailConnected: number }

type Sort = 'newest' | 'active' | 'transactions' | 'spend';
const SORTS: [Sort, string][] = [['newest', 'Newest first'], ['active', 'Recently active'], ['transactions', 'Most transactions'], ['spend', 'Highest spend']];

/** Pastel avatar per account, stable across reloads. */
const AVATAR = [['#E2F1EA', '#1E6349'], ['#EEEAF8', '#5A3F8C'], ['#E8EFFA', '#2F5A94'], ['#FAECEA', '#9A3F38'], ['#FBF3E2', '#8A5A12']];

function ago(iso: string | null): string {
  if (!iso) return 'Never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}

function Avatar({ u }: { u: AdminUser }) {
  const [soft, ink] = AVATAR[u.id % AVATAR.length];
  return (
    <span className="tile h-10 w-10 shrink-0 text-sm font-bold uppercase" style={{ background: u.isAdmin ? 'rgb(var(--ink))' : soft, color: u.isAdmin ? '#fff' : ink }}>
      {u.isAdmin ? <Icon name="shield" size={17} /> : u.email[0]}
    </span>
  );
}

function Badges({ u }: { u: AdminUser }) {
  return (
    <>
      {u.isAdmin && <span className="badge" style={{ ['--tone-soft' as string]: 'rgb(var(--ink))', ['--tone-ink' as string]: '#fff' }}>Admin</span>}
      {u.activeThisWeek && <span className="badge" style={{ ['--tone-soft' as string]: '#E2F1EA', ['--tone-ink' as string]: '#1E6349' }}>Active</span>}
    </>
  );
}

function Gmail({ u }: { u: AdminUser }) {
  if (!u.gmail) return <span className="text-muted-soft">Not connected</span>;
  const failed = !!u.lastSyncStatus && /error|fail/i.test(u.lastSyncStatus);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={u.lastSyncStatus ?? undefined}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${failed ? 'bg-debit' : 'bg-credit'}`} aria-hidden />
      <span className="truncate">{u.gmail}</span>
    </span>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<{ totals: Totals; users: AdminUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('newest');

  useEffect(() => {
    fetch('/api/admin/users')
      .then(async (r) => {
        if (r.status === 403) throw new Error('This page is only for SpendWise admins.');
        if (!r.ok) throw new Error(`Couldn’t load users (${r.status}).`);
        setData(await r.json());
      })
      .catch((e) => setError(e.message));
  }, []);

  const users = useMemo(() => {
    const list = (data?.users ?? []).filter((u) => u.email.includes(q.trim().toLowerCase()));
    const t = (s: string | null) => (s ? new Date(s).getTime() : 0);
    const cmp: Record<Sort, (a: AdminUser, b: AdminUser) => number> = {
      newest: (a, b) => t(b.createdAt) - t(a.createdAt),
      active: (a, b) => t(b.lastActivityAt) - t(a.lastActivityAt),
      transactions: (a, b) => b.transactions - a.transactions,
      spend: (a, b) => b.monthSpend - a.monthSpend,
    };
    return [...list].sort(cmp[sort]);
  }, [data, q, sort]);

  if (error) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-6 text-center">
        <span className="tile mx-auto mb-3 h-12 w-12 bg-blush text-debit"><Icon name="lock" size={20} /></span>
        <div className="font-bold">No access</div>
        <p className="mt-1 text-sm text-muted">{error}</p>
      </div>
    );
  }

  const T = data?.totals;
  const month = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const tiles = [
    { label: 'Active this week', value: T?.activeThisWeek, sub: 'added transactions', icon: 'repeat', soft: '#E2F1EA', ink: '#1E6349', solid: '#2A8A69' },
    { label: 'Transactions', value: T?.transactions.toLocaleString('en-IN'), sub: 'across all accounts', icon: 'transactions', soft: '#E8EFFA', ink: '#2F5A94', solid: '#3D7FC1' },
    { label: 'Gmail connected', value: T?.gmailConnected, sub: T ? `of ${T.users} accounts` : '', icon: 'receipt', soft: '#EEEAF8', ink: '#5A3F8C', solid: '#9B62B8' },
  ];

  return (
    <div className="space-y-5 pt-1">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="h-page">Users</h1>
          <p className="text-sm text-muted">Every SpendWise account and how it’s being used.</p>
        </div>
        <div className="flex flex-col gap-2 xs:flex-row">
          <label className="relative flex-1 sm:w-64 sm:flex-none">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={15} /></span>
            <input className="input pl-9" placeholder="Search by email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users by email" />
          </label>
          <select className="select w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort users">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-hero animate-pop col-span-2 p-4 sm:p-5 lg:col-span-1">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/[0.07]" aria-hidden />
          <div className="relative flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70 sm:text-xs">Total users</div>
            <span className="tile h-9 w-9 bg-white/15 text-white"><Icon name="users" size={16} /></span>
          </div>
          <div className="relative mt-2 text-[28px] font-extrabold leading-tight tabular">{T?.users ?? '–'}</div>
          <div className="relative mt-1 text-xs font-medium text-white/70">{T ? `${T.newThisMonth} joined in ${month}` : ' '}</div>
        </div>
        {tiles.map((t, i) => (
          <div key={t.label} className={`card-tinted animate-pop p-4 sm:p-5 ${i === tiles.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`} style={{ ['--tone-soft' as string]: t.soft, ['--tone-border' as string]: `${t.solid}33`, animationDelay: `${(i + 1) * 70}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide sm:text-xs" style={{ color: t.ink }}>{t.label}</div>
              <span className="tile h-9 w-9 shrink-0 text-white" style={{ background: t.solid }}><Icon name={t.icon} size={16} /></span>
            </div>
            <div className="mt-2 text-[28px] font-extrabold leading-tight tabular">{t.value ?? '–'}</div>
            <div className="mt-1 text-xs font-semibold" style={{ color: t.ink }}>{t.sub}</div>
          </div>
        ))}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <h2 className="h-section">All accounts</h2>
          <span className="text-xs font-semibold text-muted">{data ? `${users.length} of ${data.users.length}` : 'Loading…'}</span>
        </div>

        {data && users.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No accounts match “{q}”.</p>}

        {/* Desktop: table */}
        {users.length > 0 && (
          <div className="scroll-x hidden lg:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Account</th>
                  <th className="px-3 py-3">Joined</th>
                  <th className="px-3 py-3 text-right">Transactions</th>
                  <th className="px-3 py-3 text-right">Spent in {month}</th>
                  <th className="px-3 py-3">Gmail</th>
                  <th className="px-5 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar u={u} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><span className="truncate font-semibold">{u.email}</span><Badges u={u} /></div>
                          <div className="text-xs text-muted">ID {u.id}{u.budgets ? ` · ${u.budgets} budgets` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{fmtDate(u.createdAt)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular">{u.transactions.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular">{u.monthSpend ? inr(u.monthSpend) : <span className="text-muted-soft">–</span>}</td>
                    <td className="max-w-[220px] px-3 py-3 text-muted"><Gmail u={u} /></td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted" title={u.lastActivityAt ? fmtDateTime(u.lastActivityAt) : undefined}>{ago(u.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Phone and tablet: cards */}
        <ul className="divide-y divide-border lg:hidden">
          {users.map((u) => (
            <li key={u.id} className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <Avatar u={u} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{u.email}</div>
                  <div className="text-xs text-muted">Joined {fmtDate(u.createdAt)} · {ago(u.lastActivityAt)}</div>
                </div>
              </div>
              {(u.isAdmin || u.activeThisWeek) && <div className="flex flex-wrap gap-1.5"><Badges u={u} /></div>}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-surface-2 px-3 py-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Transactions</dt><dd className="font-bold tabular">{u.transactions.toLocaleString('en-IN')}</dd></div>
                <div className="rounded-2xl bg-surface-2 px-3 py-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Spent in {month}</dt><dd className="font-bold tabular">{u.monthSpend ? inr(u.monthSpend) : '–'}</dd></div>
                <div className="col-span-2 rounded-2xl bg-surface-2 px-3 py-2 text-muted"><dt className="text-[11px] font-semibold uppercase tracking-wide">Gmail</dt><dd className="min-w-0 text-text"><Gmail u={u} /></dd></div>
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
