'use client';

import { useEffect, useId, useState } from 'react';
import Icon from './Icon';
import { inr } from '@/lib/format';
import { splitEvenly, toPaise } from '@/lib/splits';

export interface Share {
  id: number;
  name: string;
  amount: string;
  settledAt: string | null;
}

interface Row {
  id?: number;
  name: string;
  amount: string;
  settled?: boolean;
}

/** Avatar colours, one per person in order. */
const TONES = ['#7C3AED', '#DB2777', '#F97316', '#16A34A', '#2563EB', '#C026D3', '#EAB308', '#0891B2'];

/**
 * Split a payment you made in full: your part counts as spend, the others'
 * parts are money owed to you. The parts must add up to the total before it
 * saves; a running check says by how much they're off.
 */
export default function SplitEditor({
  txnId,
  total,
  myShare,
  shares,
  onDone,
}: {
  txnId: number;
  total: number;
  myShare: string | null;
  shares: Share[];
  onDone: () => void;
}) {
  const isSplit = myShare != null;
  const [open, setOpen] = useState(isSplit);
  const [mine, setMine] = useState(isSplit ? String(Number(myShare)) : '');
  const [rows, setRows] = useState<Row[]>(
    isSplit ? shares.map((s) => ({ id: s.id, name: s.name, amount: String(Number(s.amount)), settled: !!s.settledAt })) : [{ name: '', amount: '' }],
  );
  const [names, setNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    fetch('/api/splits/people')
      .then((r) => (r.ok ? r.json() : { names: [] }))
      .then((d) => setNames(d.names ?? []))
      .catch(() => {});
  }, [open]);

  const left = toPaise(total) - toPaise(mine || 0) - rows.reduce((s, r) => s + toPaise(r.amount || 0), 0);

  function evenly() {
    const parts = splitEvenly(total, rows.length + 1);
    setMine(String(parts[0]));
    setRows((rs) => rs.map((r, i) => ({ ...r, amount: String(parts[i + 1]) })));
    setError(null);
  }

  async function save() {
    setError(null);
    if (rows.some((r) => !r.name.trim())) return setError('Give every person a name.');
    if (left !== 0) return setError(left > 0 ? `${inr(left / 100)} is still unassigned.` : `The parts are ${inr(-left / 100)} over the total.`);
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${txnId}/split`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          myShare: Number(mine || 0),
          shares: rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), amount: Number(r.amount) })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Couldn't save the split (${res.status})`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the split");
    } finally {
      setSaving(false);
    }
  }

  async function unsplit() {
    if (!confirm('Remove this split? The whole amount counts as your spend again, and any pay-backs go back to being income.')) return;
    setSaving(true);
    const res = await fetch(`/api/transactions/${txnId}/split`, { method: 'DELETE' });
    setSaving(false);
    if (!res.ok) return setError(`Couldn't remove the split (${res.status})`);
    onDone();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-outline w-full justify-start gap-2 px-3 py-2.5 text-sm">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgb(var(--ink))] text-amber">
          <Icon name="split" size={15} />
        </span>
        Split this payment
        <span className="ml-auto text-xs font-medium text-muted">Paid for others too?</span>
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border-[1.5px] border-[rgb(var(--ink))] bg-white p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgb(var(--ink))] text-amber">
            <Icon name="split" size={15} />
          </span>
          Split payment
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Total paid</div>
          <div className="tabular text-lg font-bold">{inr(total)}</div>
        </div>
      </div>

      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0891B2] text-[11px] font-bold text-white">Me</span>
          <span className="min-w-0 flex-1 text-sm font-semibold">Your share</span>
          <span className="chip hidden bg-[#CEE9F0] text-[#044F62] xs:inline-flex">My spend</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={mine}
            onChange={(e) => { setMine(e.target.value); setError(null); }}
            className="input tabular w-28 px-3 text-right"
            aria-label="Your share"
            placeholder="0"
          />
          <span className="w-9 shrink-0" />
        </div>

        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="flex items-center gap-2">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
              style={{ background: TONES[i % TONES.length] }}
            >
              {(r.name.trim()[0] || '?').toUpperCase()}
            </span>
            <input
              value={r.name}
              list={listId}
              onChange={(e) => { const name = e.target.value; setRows((rs) => rs.map((x, j) => (j === i ? { ...x, name } : x))); setError(null); }}
              className="input min-w-0 flex-1 px-3"
              placeholder="Name, e.g. Likitha"
              aria-label={`Person ${i + 1} name`}
            />
            {r.settled ? (
              <span className="chip hidden bg-[#DCFCE7] text-[#166534] xs:inline-flex"><Icon name="check" size={12} /> Paid back</span>
            ) : (
              <span className="chip hidden bg-[#EDE9FE] text-[#5B21B6] xs:inline-flex">Owes me</span>
            )}
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={r.amount}
              onChange={(e) => { const amount = e.target.value; setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount } : x))); setError(null); }}
              className="input tabular w-28 px-3 text-right"
              aria-label={`${r.name || `Person ${i + 1}`}'s share`}
              placeholder="0"
            />
            <button
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              disabled={rows.length === 1}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EF4444] text-white transition-colors hover:bg-[#DC2626] disabled:opacity-40"
              aria-label={`Remove ${r.name || `person ${i + 1}`}`}
              title="Remove"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setRows((rs) => [...rs, { name: '', amount: '' }])} className="btn-outline min-h-9 px-3 py-1.5 text-xs">
          <Icon name="plus" size={13} /> Add person
        </button>
        <button onClick={evenly} className="btn-outline min-h-9 px-3 py-1.5 text-xs">
          Split equally
        </button>
        <span
          className={`chip ml-auto px-3 py-1.5 ${left === 0 ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}
          aria-live="polite"
        >
          {left === 0 ? (
            <><Icon name="check" size={13} /> Adds up to {inr(total)}</>
          ) : left > 0 ? (
            `${inr(left / 100)} left to assign`
          ) : (
            `${inr(-left / 100)} over`
          )}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#991B1B]">
          <Icon name="alert" size={15} className="shrink-0" /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isSplit && (
          <button onClick={unsplit} disabled={saving} className="btn-ghost mr-auto px-3 py-1.5 text-xs hover:text-debit">
            <Icon name="trash" size={13} /> Remove split
          </button>
        )}
        {!isSplit && (
          <button onClick={() => setOpen(false)} className="btn-outline min-h-9 px-4 py-1.5 text-sm">
            Cancel
          </button>
        )}
        <button onClick={save} disabled={saving} className="btn-primary min-h-9 px-4 py-1.5 text-sm">
          {saving ? 'Saving…' : isSplit ? 'Update split' : 'Save split'}
        </button>
      </div>
    </div>
  );
}
