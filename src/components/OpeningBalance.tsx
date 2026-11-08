'use client';

import { useState } from 'react';
import Icon from './Icon';
import { inr } from '@/lib/format';
import type { MonthBalance } from '@/lib/balance';

const monthName = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
};

/**
 * The month's opening balance, on the dark hero: where it came from (carried
 * from last month, set by you, or the first month at 0) and a way to change
 * it — carry last month's balance forward, or type your own amount.
 */
export default function OpeningBalance({ balance, onSaved }: { balance: MonthBalance; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<'carry' | 'set'>(balance.source === 'set' || !balance.previous ? 'set' : 'carry');
  const [amount, setAmount] = useState(String(balance.opening));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = balance.previous ? monthName(balance.previous.month) : null;
  const note =
    balance.source === 'set' ? 'set by you' : balance.source === 'carried' ? `carried from ${from}` : 'first month — starts at 0';

  function open() {
    setMode(balance.source === 'set' || !balance.previous ? 'set' : 'carry');
    setAmount(String(balance.opening));
    setError(null);
    setEditing(true);
  }

  async function save() {
    setError(null);
    if (mode === 'set' && (amount.trim() === '' || !Number.isFinite(Number(amount)))) {
      return setError('Enter an amount, or 0 to start the month fresh.');
    }
    setSaving(true);
    try {
      const res = await fetch('/api/balance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: balance.month, opening: mode === 'carry' ? null : Number(amount) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Couldn't save (${res.status})`);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[rgb(var(--sidebar-muted))]">
        <span>
          Opened {monthName(balance.month)} with{' '}
          <span className="tabular font-semibold text-white">{inr(balance.opening)}</span> · {note}
        </span>
        <button
          onClick={open}
          className="inline-flex items-center gap-1 rounded-lg bg-amber px-2.5 py-1 text-xs font-bold text-[rgb(var(--ink))] transition-transform hover:scale-[1.03] active:scale-95"
        >
          <Icon name="edit" size={12} /> Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-3.5 text-[rgb(var(--ink))] sm:p-4">
      <div className="font-semibold">Opening balance for {monthName(balance.month)}</div>

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Opening balance">
        {balance.previous && (
          <button
            role="radio"
            aria-checked={mode === 'carry'}
            onClick={() => setMode('carry')}
            className={`rounded-xl border-[1.5px] border-[rgb(var(--ink))] px-3 py-2.5 text-left ${mode === 'carry' ? 'bg-[rgb(var(--ink))] text-white' : 'bg-white hover:bg-surface-2'}`}
          >
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <Icon name="repeat" size={14} /> Carry forward
            </div>
            <div className={`text-xs ${mode === 'carry' ? 'text-amber' : 'text-muted'}`}>
              {from}’s leftover · <span className="tabular font-semibold">{inr(balance.previous.closing)}</span>
            </div>
          </button>
        )}
        <button
          role="radio"
          aria-checked={mode === 'set'}
          onClick={() => setMode('set')}
          className={`rounded-xl border-[1.5px] border-[rgb(var(--ink))] px-3 py-2.5 text-left ${mode === 'set' ? 'bg-[rgb(var(--ink))] text-white' : 'bg-white hover:bg-surface-2'}`}
        >
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Icon name="edit" size={14} /> Set my own amount
          </div>
          <div className={`text-xs ${mode === 'set' ? 'text-amber' : 'text-muted'}`}>What was really in the account on the 1st</div>
        </button>
      </div>

      {mode === 'set' && (
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">₹</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="input tabular flex-1 text-right"
            aria-label="Opening balance"
            autoFocus
          />
          <button onClick={() => { setAmount('0'); setError(null); }} className="btn-outline min-h-11 px-3 text-xs">
            Start at 0
          </button>
        </div>
      )}

      <p className="text-xs text-muted">Later months carry forward from this, unless you set them too.</p>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-[#FEE2E2] px-3 py-2 text-sm font-semibold text-[#991B1B]">
          <Icon name="alert" size={15} className="shrink-0" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(false)} className="btn-outline min-h-9 px-4 py-1.5 text-sm">
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="btn-accent min-h-9 px-4 py-1.5 text-sm">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
