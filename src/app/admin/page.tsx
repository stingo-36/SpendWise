'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { inr, fmtDate, fmtDateTime } from '@/lib/format';
import Icon from '@/components/Icon';
import PasswordField from '@/components/PasswordField';

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
  kaizenConnectedAt: string | null;
  kaizenLastSeenAt: string | null;
}
interface Totals { users: number; newThisMonth: number; activeThisWeek: number; transactions: number; gmailConnected: number; kaizenConnected: number }

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

function Kaizen({ u }: { u: AdminUser }) {
  const seen = u.kaizenLastSeenAt ?? u.kaizenConnectedAt;
  if (!seen) return <span className="text-muted-soft">Not connected</span>;
  // Kaizen never tells us it disconnected, so a long silence reads as idle, not connected.
  const idle = Date.now() - new Date(seen).getTime() > 30 * 86_400_000;
  return (
    <span className="inline-flex items-start gap-1.5" title={`Last opened ${fmtDateTime(seen)}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${idle ? 'bg-muted-soft' : 'bg-credit'}`} aria-hidden />
      <span className="leading-tight">
        <span className="block">{idle ? 'Idle' : 'Connected'}</span>
        <span className="block whitespace-nowrap text-xs text-muted-soft">{ago(seen)}</span>
      </span>
    </span>
  );
}

interface PipelineStatus {
  llmConfigured: boolean;
  counts: { rawEmails: number; pending: number; unparsed: number; transactions: number; reviewQueue: number };
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

/** What each step does, in plain words, shown under its button. */
const STEPS: { step: string; label: string; icon: string; help: (s: PipelineStatus | null) => string }[] = [
  { step: 'sync', label: 'Sync', icon: 'repeat', help: () => 'Runs everything in one go: pulls new bank alert emails from this account’s Gmail, turns them into transactions and puts them in categories. Same as the user’s Sync now button and the daily sync.' },
  { step: 'parse', label: 'Parse pending', icon: 'review', help: (s) => `Reads bank emails that are already downloaded but not yet turned into transactions.${s ? ` ${s.counts.pending} waiting.` : ''}` },
  { step: 'categorize', label: 'Categorize', icon: 'keywords', help: (s) => `Puts uncategorised transactions into categories, first with keyword rules, then AI for anything left. AI is ${s?.llmConfigured ? 'on' : 'off — add an Anthropic key in App settings to turn it on'}.` },
  { step: 'subscriptions', label: 'Detect subscriptions', icon: 'subscriptions', help: () => 'Looks for repeating payments, like Netflix every month, and adds them to the user’s Subscriptions page.' },
  { step: 'dedupe', label: 'Remove duplicates', icon: 'transactions', help: () => 'Merges the same payment recorded twice, for example when both an email and an SMS arrived for it.' },
];

/** One account's pipeline: its counts, and each step as a button with what it does. */
function PipelinePanel({ u, onRan }: { u: AdminUser; onRan: () => void }) {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ step: string; ok: boolean; summary: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/users/${u.id}/pipeline`).then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => {});
  }, [u.id]);

  async function run(step: string) {
    setBusy(step);
    setResult(null);
    const res = await fetch(`/api/admin/users/${u.id}/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    });
    const d = await res.json().catch(() => ({ ok: false, summary: `Failed (${res.status})` }));
    setBusy(null);
    setResult({ step, ok: !!d.ok, summary: d.summary });
    if (d.status) setStatus(d.status);
    onRan();
  }

  const c = status?.counts;
  const stats: [string, number | string | undefined][] = [
    ['Raw emails', c?.rawEmails], ['Pending parse', c?.pending], ['Unparsed', c?.unparsed],
    ['Transactions', c?.transactions], ['Review queue', c?.reviewQueue], ['AI categorising', status ? (status.llmConfigured ? 'On' : 'Off') : undefined],
  ];

  return (
    <div className="space-y-3 rounded-3xl bg-surface-2/70 p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2 xs:grid-cols-3 xl:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
            <div className="font-bold tabular">{value ?? '–'}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        {status?.lastSyncAt ? `Last sync ${fmtDateTime(status.lastSyncAt)} — ${status.lastSyncStatus ?? ''}` : status ? 'Never synced' : 'Loading…'}
      </p>
      <ul className="grid gap-2 xl:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.step} className="flex items-start gap-3 rounded-2xl bg-surface p-3">
            <button onClick={() => run(s.step)} disabled={busy != null} className="btn-primary shrink-0 whitespace-nowrap px-3.5 py-2 text-xs">
              <Icon name={s.icon} size={14} /> {busy === s.step ? 'Running…' : s.label}
            </button>
            <div className="min-w-0 text-xs leading-relaxed text-muted">
              {s.help(status)}
              {result?.step === s.step && (
                <div role="status" className={`mt-1.5 font-semibold ${result.ok ? 'text-credit' : 'text-debit'}`}>{result.summary}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Change an account's email and/or password. Works on the admin's own account too. */
function EditUser({ u, onClose, onSaved }: { u: AdminUser; onClose: () => void; onSaved: (msg: string) => void }) {
  const [email, setEmail] = useState(u.email);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nextEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail)) return setError('Enter a valid email');
    if (password && password.length < 6) return setError('Password must be at least 6 characters');
    if (nextEmail === u.email && !password) return setError('Change the email or enter a new password');
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nextEmail, ...(password ? { password } : {}) }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || `Couldn’t save (${res.status})`);
    const what = [d.changed?.email && 'email', d.changed?.password && 'password'].filter(Boolean).join(' and ');
    onSaved(`Updated ${what} for ${d.user?.email ?? nextEmail}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="sheet w-full space-y-4 rounded-t-3xl border border-border bg-surface p-5 shadow-card animate-fade-up sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center gap-3">
          <Avatar u={u} />
          <div className="min-w-0 flex-1">
            <h2 id="edit-user-title" className="h-section">Edit account</h2>
            <p className="truncate text-xs text-muted">ID {u.id} · joined {fmtDate(u.createdAt)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn"><Icon name="close" size={16} /></button>
        </div>

        <div>
          <label htmlFor="edit-email" className="mb-1.5 block text-xs font-semibold text-muted">Email</label>
          <input id="edit-email" className="input" type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} />
        </div>
        <div>
          <PasswordField label="New password" value={password} onChange={(v) => { setPassword(v); setError(null); }} placeholder="Leave empty to keep the current one" autoComplete="new-password" strength />
          <p className="mt-1.5 text-xs text-muted">Devices already signed in stay signed in.</p>
        </div>

        {u.isAdmin && (
          <p className="rounded-2xl bg-surface-2 px-3 py-2 text-xs text-muted">This is an admin account. It stays an admin if you change its email.</p>
        )}
        {error && <p className="text-sm font-semibold text-debit">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}

/** Delete an account and all its data. The admin has to type the email to confirm. */
function DeleteUser({ u, onClose, onDeleted }: { u: AdminUser; onClose: () => void; onDeleted: (msg: string) => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === u.email;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}?confirm=${encodeURIComponent(u.email)}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || `Couldn’t delete (${res.status})`);
    onDeleted(`Deleted ${u.email} and ${(d.removed?.transactions ?? 0).toLocaleString('en-IN')} transactions`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <form
        onSubmit={remove}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        className="sheet w-full space-y-4 rounded-t-3xl border border-border bg-surface p-5 shadow-card animate-fade-up sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center gap-3">
          <span className="tile h-10 w-10 shrink-0 bg-blush text-debit"><Icon name="trash" size={17} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="delete-user-title" className="h-section">Delete account</h2>
            <p className="truncate text-xs text-muted">{u.email} · ID {u.id}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="icon-btn"><Icon name="close" size={16} /></button>
        </div>

        <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm text-muted">
          This permanently removes the account and all its data — {u.transactions.toLocaleString('en-IN')} transactions, bank emails, subscriptions, budgets, credit cards, keyword rules and the Gmail connection. It can’t be undone.
        </p>
        <div>
          <label htmlFor="delete-confirm" className="mb-1.5 block text-xs font-semibold text-muted">Type <span className="font-bold text-text">{u.email}</span> to confirm</label>
          <input id="delete-confirm" className="input" autoComplete="off" autoFocus value={typed} onChange={(e) => { setTyped(e.target.value); setError(null); }} />
        </div>
        {error && <p className="text-sm font-semibold text-debit">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="btn-outline flex-1">Cancel</button>
          <button type="submit" disabled={!matches || busy} className="btn flex-1 bg-[rgb(var(--debit))] px-5 py-2.5 text-white active:scale-[0.97] disabled:opacity-50">{busy ? 'Deleting…' : 'Delete account'}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<{ totals: Totals; users: AdminUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [pipelineFor, setPipelineFor] = useState<number | null>(null);
  const togglePipeline = (id: number) => setPipelineFor((cur) => (cur === id ? null : id));
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch('/api/admin/users')
      .then(async (r) => {
        if (r.status === 403) {
          fetch('/api/me').then((m) => m.json()).then((d) => setSignedInAs(d.email ?? null)).catch(() => {});
          throw new Error('This page is only for SpendWise admins.');
        }
        if (!r.ok) throw new Error(`Couldn’t load users (${r.status}).`);
        setData(await r.json());
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

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
        {signedInAs && (
          <>
            <p className="mt-3 text-sm text-muted">You’re signed in as <span className="font-semibold text-text">{signedInAs}</span>.</p>
            <button
              className="btn-primary mt-4"
              onClick={async () => {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/login?next=/admin';
              }}
            >
              Sign in as admin
            </button>
          </>
        )}
      </div>
    );
  }

  const T = data?.totals;
  const month = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const tiles = [
    { label: 'Active this week', value: T?.activeThisWeek, sub: 'added transactions', icon: 'repeat', soft: '#E2F1EA', ink: '#1E6349', solid: '#2A8A69' },
    { label: 'Gmail connected', value: T?.gmailConnected, sub: T ? `of ${T.users} accounts` : '', icon: 'receipt', soft: '#EEEAF8', ink: '#5A3F8C', solid: '#9B62B8' },
    { label: 'Kaizen connected', value: T?.kaizenConnected, sub: T ? `of ${T.users} accounts` : '', icon: 'phone', soft: '#E8EFFA', ink: '#2F5A94', solid: '#3D7FC1' },
  ];

  return (
    <div className="space-y-5 pt-1">
      {editing && (
        <EditUser
          u={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setNotice(msg);
            load();
          }}
        />
      )}
      {deleting && (
        <DeleteUser
          u={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(msg) => {
            if (pipelineFor === deleting.id) setPipelineFor(null);
            setDeleting(null);
            setNotice(msg);
            load();
          }}
        />
      )}
      {notice && (
        <div role="status" className="card-tinted animate-fade-in flex items-center gap-2.5 p-3 text-sm font-semibold" style={{ ['--tone-soft' as string]: '#E2F1EA', ['--tone-border' as string]: '#2A8A6940' }}>
          <span className="tile h-7 w-7 shrink-0 bg-[rgb(var(--credit))] text-white"><Icon name="check" size={14} /></span>
          {notice}
        </div>
      )}
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
          <span className="text-xs font-semibold text-muted">{data ? `${users.length} of ${data.users.length} · ${data.totals.transactions.toLocaleString('en-IN')} transactions` : 'Loading…'}</span>
        </div>

        {data && users.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted">No accounts match “{q}”.</p>}

        {/* Desktop: table */}
        {users.length > 0 && (
          <div className="scroll-x hidden xl:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="whitespace-nowrap text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Account</th>
                  <th className="px-2.5 py-3">Joined</th>
                  <th className="px-2.5 py-3 text-right">Spent · {month.slice(0, 3)}</th>
                  <th className="px-2.5 py-3">Gmail</th>
                  <th className="px-2.5 py-3">Kaizen</th>
                  <th className="px-2.5 py-3">Last activity</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                  <tr className="border-t border-border transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar u={u} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2"><span className="truncate font-semibold">{u.email}</span><Badges u={u} /></div>
                          <div className="text-xs text-muted">ID {u.id} · {u.transactions.toLocaleString('en-IN')} transactions{u.budgets ? ` · ${u.budgets} budgets` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3 text-muted">{fmtDate(u.createdAt)}</td>
                    <td className="px-2.5 py-3 text-right font-semibold tabular">{u.monthSpend ? inr(u.monthSpend) : <span className="text-muted-soft">–</span>}</td>
                    <td className="max-w-[170px] px-2.5 py-3 text-muted"><Gmail u={u} /></td>
                    <td className="px-2.5 py-3 text-muted"><Kaizen u={u} /></td>
                    <td className="whitespace-nowrap px-2.5 py-3 text-muted" title={u.lastActivityAt ? fmtDateTime(u.lastActivityAt) : undefined}>{ago(u.lastActivityAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => togglePipeline(u.id)} aria-expanded={pipelineFor === u.id} className={`whitespace-nowrap px-3 py-1.5 text-xs ${pipelineFor === u.id ? 'btn-primary' : 'btn-outline'}`}>
                          <Icon name="parsers" size={13} /> Pipeline
                        </button>
                        <button onClick={() => setEditing(u)} className="btn-outline whitespace-nowrap px-3 py-1.5 text-xs" aria-label={`Edit ${u.email}`}>
                          <Icon name="edit" size={13} /> Edit
                        </button>
                        {!u.isAdmin && (
                          <button onClick={() => setDeleting(u)} className="icon-btn-danger h-[30px] w-[30px]" aria-label={`Delete ${u.email}`} title="Delete account">
                            <Icon name="trash" size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {pipelineFor === u.id && (
                    <tr>
                      <td colSpan={7} className="px-5 pb-4">
                        {/* w-0 min-w-full: fill the row without letting the help text widen the table. */}
                        <div className="w-0 min-w-full"><PipelinePanel u={u} onRan={load} /></div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Below 1280px: cards (two columns from tablet width) */}
        <ul className="-mb-px grid md:grid-cols-2 xl:hidden [&>li]:border-b [&>li]:border-border md:[&>li:nth-child(odd)]:border-r">
          {users.map((u) => (
            <li key={u.id} className="space-y-3 bg-surface px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <Avatar u={u} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{u.email}</div>
                  <div className="text-xs text-muted">Joined {fmtDate(u.createdAt)} · {ago(u.lastActivityAt)}</div>
                </div>
                <button onClick={() => setEditing(u)} className="icon-btn-accent" aria-label={`Edit ${u.email}`}><Icon name="edit" size={15} /></button>
                {!u.isAdmin && <button onClick={() => setDeleting(u)} className="icon-btn-danger" aria-label={`Delete ${u.email}`}><Icon name="trash" size={15} /></button>}
              </div>
              {(u.isAdmin || u.activeThisWeek) && <div className="flex flex-wrap gap-1.5"><Badges u={u} /></div>}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-2xl bg-surface-2 px-3 py-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Transactions</dt><dd className="font-bold tabular">{u.transactions.toLocaleString('en-IN')}</dd></div>
                <div className="rounded-2xl bg-surface-2 px-3 py-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Spent in {month}</dt><dd className="font-bold tabular">{u.monthSpend ? inr(u.monthSpend) : '–'}</dd></div>
                <div className="col-span-2 rounded-2xl bg-surface-2 px-3 py-2 text-muted"><dt className="text-[11px] font-semibold uppercase tracking-wide">Gmail</dt><dd className="min-w-0 text-text"><Gmail u={u} /></dd></div>
                <div className="col-span-2 rounded-2xl bg-surface-2 px-3 py-2 text-muted"><dt className="text-[11px] font-semibold uppercase tracking-wide">Kaizen</dt><dd className="min-w-0 text-text"><Kaizen u={u} /></dd></div>
              </dl>
              <button onClick={() => togglePipeline(u.id)} aria-expanded={pipelineFor === u.id} className={`w-full py-2 text-xs ${pipelineFor === u.id ? 'btn-primary' : 'btn-outline'}`}>
                <Icon name="parsers" size={13} /> {pipelineFor === u.id ? 'Hide pipeline' : 'Pipeline'}
              </button>
              {pipelineFor === u.id && <PipelinePanel u={u} onRan={load} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
