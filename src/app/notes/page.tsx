'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { inr, fmtDate } from '@/lib/format';
import Icon from '@/components/Icon';
import { categoryStyle } from '@/lib/palette';

interface Txn {
  id: number;
  occurredAt: string;
  amount: string;
  direction: 'debit' | 'credit';
  label: string;
  categoryName: string | null;
  subcategoryName: string | null;
}

interface Note {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  transactions: Txn[];
}

/** The note being edited. id null = a new note not saved yet. */
interface Draft {
  id: number | null;
  title: string;
  body: string;
  transactions: Txn[];
}

const EMPTY: Draft = { id: null, title: '', body: '', transactions: [] };

function totals(txns: Txn[]) {
  let spent = 0;
  let received = 0;
  for (const t of txns) {
    if (t.direction === 'credit') received += Number(t.amount);
    else spent += Number(t.amount);
  }
  return { spent, received };
}

function sameDraft(d: Draft, n: Note | undefined): boolean {
  if (!n) return !d.title && !d.body && d.transactions.length === 0;
  return d.title === n.title && d.body === n.body && d.transactions.map((t) => t.id).join() === n.transactions.map((t) => t.id).join();
}

function TxnRow({ t, children }: { t: Txn; children?: React.ReactNode }) {
  const style = categoryStyle(t.categoryName, t.direction === 'debit');
  return (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold" style={{ background: style.soft, color: style.ink }}>
        {t.label.trim().charAt(0).toUpperCase() || '·'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{t.label}</div>
        <div className="truncate text-xs text-muted">
          {fmtDate(t.occurredAt)}
          {t.categoryName && ` · ${t.categoryName}${t.subcategoryName ? ` › ${t.subcategoryName}` : ''}`}
        </div>
      </div>
      <span className={`tabular whitespace-nowrap font-semibold ${t.direction === 'credit' ? 'text-credit' : 'text-debit'}`}>
        {t.direction === 'credit' ? '+' : '−'}{inr(Number(t.amount))}
      </span>
      {children}
    </>
  );
}

/** Search the user's transactions and tick the ones to attach. */
function TransactionPicker({
  selected,
  initialQuery = '',
  onClose,
  onDone,
}: {
  selected: Txn[];
  initialQuery?: string;
  onClose: () => void;
  onDone: (txns: Txn[]) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<Txn[] | null>(null);
  const [picked, setPicked] = useState<Map<number, Txn>>(() => new Map(selected.map((t) => [t.id, t])));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced so typing a merchant name doesn't fire a request per keystroke.
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const params = new URLSearchParams({ pageSize: '50' });
      if (q.trim()) params.set('merchant', q.trim());
      fetch(`/api/transactions?${params}`)
        .then((r) => r.json())
        .then((d) => live && setResults(d.items ?? []))
        .catch(() => live && setResults([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  function toggle(t: Txn) {
    setPicked((cur) => {
      const next = new Map(cur);
      if (next.has(t.id)) next.delete(t.id);
      else next.set(t.id, t);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="sheet flex max-h-[85vh] w-full flex-col rounded-t-3xl border border-border bg-surface shadow-card animate-fade-up sm:max-w-lg sm:rounded-3xl"
      >
        <div className="space-y-3 border-b border-border p-5 pb-4">
          <div className="flex items-center gap-3">
            <h2 id="picker-title" className="h-section flex-1">Attach transactions</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="icon-btn"><Icon name="close" size={16} /></button>
          </div>
          <label className="relative block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={15} /></span>
            <input className="input pl-9" placeholder="Search by merchant" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search transactions by merchant" />
          </label>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
          {results === null && <li className="py-8 text-center text-sm text-muted">Loading…</li>}
          {results?.length === 0 && <li className="py-8 text-center text-sm text-muted">{q.trim() ? `No transactions match “${q.trim()}”.` : 'No transactions yet.'}</li>}
          {results?.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5 text-sm">
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t)} className="h-4 w-4 shrink-0 accent-[rgb(var(--accent))]" />
                <TxnRow t={t} />
              </label>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 border-t border-border p-4">
          <span className="flex-1 text-xs font-semibold text-muted">{picked.size} selected</span>
          <button type="button" onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            onClick={() => onDone([...picked.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))}
            className="btn-primary px-4 py-2 text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [attachQuery, setAttachQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/notes', { cache: 'no-store' });
    if (!r.ok) return setError(`Couldn’t load notes (${r.status}).`);
    const d = await r.json();
    setNotes(d.notes);
    return d.notes as Note[];
  }, []);

  useEffect(() => {
    // On desktop, open the most recent note so the editor isn't a blank pane.
    load().then((list) => {
      const first = list?.[0];
      if (first && window.matchMedia('(min-width: 1024px)').matches) {
        setDraft((d) => d ?? { id: first.id, title: first.title, body: first.body, transactions: first.transactions });
      }
    });
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!notes || !term) return notes ?? [];
    return notes.filter((n) => n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term) || n.transactions.some((t) => t.label.toLowerCase().includes(term)));
  }, [notes, q]);

  const saved = draft?.id != null ? notes?.find((n) => n.id === draft.id) : undefined;
  const dirty = !!draft && !sameDraft(draft, saved);

  function open(next: Draft | null) {
    if (dirty && !confirm('Discard unsaved changes to this note?')) return;
    setSaveError(null);
    setDraft(next);
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) return setSaveError('Give the note a title');
    setBusy(true);
    setSaveError(null);
    const res = await fetch(draft.id == null ? '/api/notes' : `/api/notes/${draft.id}`, {
      method: draft.id == null ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: draft.title, body: draft.body, transactionIds: draft.transactions.map((t) => t.id) }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setSaveError(d.error || `Couldn’t save (${res.status})`);
    await load();
    // Saved — clear the editor for the next note; the saved one is in the list.
    setDraft(EMPTY);
  }

  async function remove() {
    if (!draft) return;
    if (draft.id == null) return setDraft(null);
    if (!confirm(`Delete “${draft.title || 'this note'}”? The transactions themselves stay.`)) return;
    setBusy(true);
    await fetch(`/api/notes/${draft.id}`, { method: 'DELETE' });
    setBusy(false);
    setDraft(null);
    load();
  }

  if (error) return <div className="card mx-auto mt-10 max-w-md p-6 text-center text-sm text-muted">{error}</div>;

  const t = draft ? totals(draft.transactions) : null;

  return (
    <div className="space-y-5 pt-1">
      {picking && draft && (
        <TransactionPicker
          selected={draft.transactions}
          initialQuery={attachQuery}
          onClose={() => setPicking(false)}
          onDone={(txns) => {
            setDraft({ ...draft, transactions: txns });
            setPicking(false);
          }}
        />
      )}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Keep the story behind the money</div>
          <h1 className="h-page mt-1.5">Notes</h1>
        </div>
        <button onClick={() => open({ ...EMPTY })} className="btn-accent self-start whitespace-nowrap px-4 sm:self-auto">
          <Icon name="plus" size={16} /> New note
        </button>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* List — hidden on small screens while a note is open */}
        <aside aria-label="All notes" className={`flex flex-col gap-2.5 ${draft ? 'hidden lg:flex' : ''}`}>
          <label className="relative block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={15} /></span>
            <input className="input pl-9" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" />
          </label>
          {notes === null ? (
            <p className="card py-10 text-center text-sm text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="card px-5 py-10 text-center text-sm text-muted">
              {notes.length === 0 ? (
                <>
                  <span className="tile mx-auto mb-3 h-12 w-12 bg-surface-2 text-muted"><Icon name="note" size={20} /></span>
                  No notes yet. Start one with <span className="font-semibold text-text">New note</span>.
                </>
              ) : (
                `No notes match “${q.trim()}”.`
              )}
            </div>
          ) : (
            filtered.map((n) => {
              const s = totals(n.transactions);
              const active = draft?.id === n.id;
              return (
                <button
                  key={n.id}
                  data-animate
                  onClick={() => open({ id: n.id, title: n.title, body: n.body, transactions: n.transactions })}
                  aria-current={active ? 'true' : undefined}
                  className={`flex w-full flex-col gap-1.5 rounded-2xl p-4 text-left transition-colors ${
                    active ? 'border border-[rgb(var(--ink))] bg-[rgb(var(--ink))] text-white' : 'border border-border bg-surface hover:border-[rgb(var(--text))]/40'
                  }`}
                >
                  <span className="truncate font-bold">{n.title}</span>
                  {n.body && <span className={`line-clamp-2 text-[13px] ${active ? 'text-[rgb(var(--sidebar-muted))]' : 'text-muted'}`}>{n.body}</span>}
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`chip ${active ? 'bg-white/10 text-amber' : 'bg-surface-2 text-text'}`}>
                      {n.transactions.length} payment{n.transactions.length === 1 ? '' : 's'}
                    </span>
                    {s.spent > 0 && <span className={`chip tabular ${active ? 'bg-white/10 text-white' : 'bg-surface-2 text-text'}`}>{inr(s.spent)}</span>}
                    {!n.transactions.length && <span className={`chip ${active ? 'bg-white/10 text-white' : 'bg-surface-2 text-muted'}`}>{fmtDate(n.updatedAt)}</span>}
                  </span>
                </button>
              );
            })
          )}
        </aside>

        {/* Editor */}
        {draft ? (
          <section className="card flex flex-col gap-4 p-5 sm:p-7">
            <div className="flex items-center gap-2">
              <button onClick={() => open(null)} className="icon-btn lg:hidden" aria-label="Back to notes"><Icon name="close" size={16} /></button>
              <span className="flex-1 text-xs text-muted">
                {draft.id == null ? 'New note' : dirty ? 'Unsaved changes' : saved ? `Edited ${fmtDate(saved.updatedAt)} · saved` : ''}
              </span>
              {dirty && saved && (
                <button onClick={() => setDraft({ id: saved.id, title: saved.title, body: saved.body, transactions: saved.transactions })} className="btn-ghost min-h-10 px-3 text-xs">
                  Undo
                </button>
              )}
              <button onClick={save} disabled={busy || !dirty} className="btn-primary min-h-10 px-4">{busy ? 'Saving…' : 'Save'}</button>
              <button onClick={remove} disabled={busy} className="btn-outline min-h-10 px-4 text-debit" aria-label="Delete note">
                {draft.id == null ? 'Discard' : 'Delete'}
              </button>
            </div>

            {/* Labelled fields with a soft ground, so title and body read as two boxes. */}
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Title</span>
              <input
                className="w-full rounded-2xl bg-surface-2 px-4 py-3 font-display text-[clamp(1.375rem,3vw,1.875rem)] font-extrabold tracking-[-0.02em] outline-none transition-shadow placeholder:font-bold placeholder:text-muted/60 focus:ring-2 focus:ring-[rgb(var(--ink))]/15"
                placeholder="e.g. Goa trip expenses"
                value={draft.title}
                onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setSaveError(null); }}
                maxLength={120}
                autoFocus={draft.id == null}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Note</span>
              <textarea
                className="min-h-[140px] w-full resize-y rounded-2xl bg-surface-2 px-4 py-3 text-[15px] leading-relaxed outline-none transition-shadow placeholder:text-muted/70 focus:ring-2 focus:ring-[rgb(var(--ink))]/15"
                placeholder="Who paid, what’s still owed, why this charge happened…"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            </label>
            {saveError && <p className="text-sm font-semibold text-debit">{saveError}</p>}

            <div className="flex flex-col border-t border-border pt-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="h-section">Attached payments</h2>
                {t && draft.transactions.length > 0 && (
                  <span className="tabular text-sm font-semibold">
                    {inr(t.spent)}
                    {t.received > 0 && <span className="text-muted"> · net {inr(t.spent - t.received)}</span>}
                  </span>
                )}
              </div>
              {draft.transactions.length === 0 ? (
                <p className="py-3 text-sm text-muted">Nothing attached yet. Search below for the payments this note is about.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {draft.transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <TxnRow t={tx}>
                        <button
                          onClick={() => setDraft({ ...draft, transactions: draft.transactions.filter((x) => x.id !== tx.id) })}
                          className="icon-btn h-9 w-9 shrink-0"
                          aria-label={`Detach ${tx.label}`}
                          title="Detach"
                        >
                          <Icon name="close" size={14} />
                        </button>
                      </TxnRow>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="mt-3 flex gap-2 rounded-2xl bg-surface-2 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPicking(true);
                }}
              >
                <input
                  className="input flex-1"
                  placeholder="Search by merchant to attach"
                  aria-label="Search transactions by merchant"
                  value={attachQuery}
                  onChange={(e) => setAttachQuery(e.target.value)}
                />
                <button type="submit" className="btn-primary px-5">Attach</button>
              </form>
            </div>
          </section>
        ) : (
          <section className="card hidden place-items-center p-10 text-center text-sm text-muted lg:grid">
            <div>
              <span className="tile mx-auto mb-3 h-12 w-12 bg-surface-2 text-muted"><Icon name="note" size={20} /></span>
              Pick a note on the left, or start a new one.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
