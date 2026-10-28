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
      <span className="tile h-9 w-9 shrink-0 rounded-xl text-white" style={{ background: style.solid }}>
        <Icon name={style.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{t.label}</div>
        <div className="truncate text-xs font-medium text-muted">
          {fmtDate(t.occurredAt)}
          {t.categoryName && ` · ${t.categoryName}${t.subcategoryName ? ` › ${t.subcategoryName}` : ''}`}
        </div>
      </div>
      <span className={`tabular whitespace-nowrap font-extrabold ${t.direction === 'credit' ? 'text-credit' : 'text-debit'}`}>
        {t.direction === 'credit' ? '+' : '−'}{inr(Number(t.amount))}
      </span>
      {children}
    </>
  );
}

/** Search the user's transactions and tick the ones to attach. */
function TransactionPicker({ selected, onClose, onDone }: { selected: Txn[]; onClose: () => void; onDone: (txns: Txn[]) => void }) {
  const [q, setQ] = useState('');
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
    load();
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
    setDraft({ id: d.note.id, title: d.note.title, body: d.note.body, transactions: d.note.transactions });
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
          onClose={() => setPicking(false)}
          onDone={(txns) => {
            setDraft({ ...draft, transactions: txns });
            setPicking(false);
          }}
        />
      )}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="h-page">Notes</h1>
          <p className="text-sm text-muted">Keep notes about payments and attach the transactions they’re about — just for the record.</p>
        </div>
        <button onClick={() => open({ ...EMPTY })} className="btn-primary self-start whitespace-nowrap sm:self-auto">
          <Icon name="plus" size={16} /> New note
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* List — hidden on small screens while a note is open */}
        <section className={`card overflow-hidden ${draft ? 'hidden lg:block' : ''}`}>
          <div className="border-b border-border p-3">
            <label className="relative block">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"><Icon name="search" size={15} /></span>
              <input className="input pl-9" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" />
            </label>
          </div>
          {notes === null ? (
            <p className="py-10 text-center text-sm text-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">
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
            <ul className="divide-y divide-border">
              {filtered.map((n) => {
                const s = totals(n.transactions);
                const active = draft?.id === n.id;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => open({ id: n.id, title: n.title, body: n.body, transactions: n.transactions })}
                      aria-current={active ? 'true' : undefined}
                      className={`block w-full px-4 py-3 text-left transition-colors ${active ? 'bg-surface-2' : 'hover:bg-surface-2/60'}`}
                    >
                      <div className="truncate text-sm font-bold">{n.title}</div>
                      {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</div>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-muted">
                        <span>{fmtDate(n.updatedAt)}</span>
                        {n.transactions.length > 0 && (
                          <>
                            <span>· {n.transactions.length} transaction{n.transactions.length === 1 ? '' : 's'}</span>
                            {s.spent > 0 && <span className="text-debit">−{inr(s.spent)}</span>}
                            {s.received > 0 && <span className="text-credit">+{inr(s.received)}</span>}
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Editor */}
        {draft ? (
          <section className="card space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <button onClick={() => open(null)} className="icon-btn lg:hidden" aria-label="Back to notes"><Icon name="close" size={16} /></button>
              <span className="flex-1 text-xs font-semibold text-muted">
                {draft.id == null ? 'New note' : dirty ? 'Unsaved changes' : saved ? `Saved ${fmtDate(saved.updatedAt)}` : ''}
              </span>
              <button onClick={remove} disabled={busy} className="icon-btn-danger" aria-label="Delete note" title={draft.id == null ? 'Discard' : 'Delete note'}>
                <Icon name="trash" size={15} />
              </button>
            </div>

            <input
              className="w-full bg-transparent text-xl font-extrabold tracking-tight outline-none placeholder:text-muted/60"
              placeholder="Title, e.g. Goa trip expenses"
              value={draft.title}
              onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setSaveError(null); }}
              maxLength={120}
              aria-label="Note title"
              autoFocus={draft.id == null}
            />
            <textarea
              className="input min-h-[160px] resize-y leading-relaxed"
              placeholder="Write anything — who paid, what’s still owed, why this charge happened…"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              aria-label="Note text"
            />

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="flex-1 text-[15px] font-bold">Transactions</h2>
                {t && draft.transactions.length > 0 && (
                  <span className="text-xs font-semibold text-muted">
                    {t.spent > 0 && <span className="text-debit">Spent {inr(t.spent)}</span>}
                    {t.spent > 0 && t.received > 0 && ' · '}
                    {t.received > 0 && <span className="text-credit">Received {inr(t.received)}</span>}
                  </span>
                )}
                <button onClick={() => setPicking(true)} className="btn-outline px-3 py-1.5 text-xs">
                  <Icon name="plus" size={13} /> Attach
                </button>
              </div>
              {draft.transactions.length === 0 ? (
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">No transactions attached. Use Attach to pick the payments this note is about.</p>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border px-3">
                  {draft.transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <TxnRow t={tx}>
                        <button
                          onClick={() => setDraft({ ...draft, transactions: draft.transactions.filter((x) => x.id !== tx.id) })}
                          className="icon-btn h-8 w-8 shrink-0"
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
            </div>

            {saveError && <p className="text-sm font-semibold text-debit">{saveError}</p>}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {dirty && saved && (
                <button onClick={() => setDraft({ id: saved.id, title: saved.title, body: saved.body, transactions: saved.transactions })} className="btn-outline">
                  Undo changes
                </button>
              )}
              <button onClick={save} disabled={busy || !dirty} className="btn-primary">{busy ? 'Saving…' : 'Save note'}</button>
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
