'use client';

import { useMemo, useState } from 'react';
import { useCategories } from '@/lib/useCategories';
import { CategoryDropdown } from './Select';

/** Today's date and the current time, in the browser's own timezone. */
function localNow() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

/** Manual income/expense entry form (spec: user enters income manually). */
export default function AddTransaction({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const categories = useCategories();
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  // Local, not UTC: toISOString() would roll the date over for anyone whose
  // offset puts them on a different calendar day than UTC right now.
  const [date, setDate] = useState(() => localNow().date);
  const [time, setTime] = useState(() => localNow().time);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subs = useMemo(() => categories.find((c) => c.id === Number(categoryId))?.subcategories ?? [], [categories, categoryId]);

  async function submit() {
    if (!amount || Number(amount) <= 0) {
      setError('Enter an amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          amount: Number(amount),
          occurredAt: new Date(`${date}T${time || '00:00'}`).toISOString(),
          description: description.trim(),
          categoryId: categoryId || null,
          subcategoryId: subcategoryId || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="sheet w-full space-y-3 rounded-t-3xl border border-border bg-surface p-4 sm:p-5 shadow-card sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add transaction</h2>
          <button onClick={onClose} aria-label="Close" className="icon-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Income / Expense toggle */}
        <div className="inline-flex w-full rounded-full border border-border bg-surface-2 p-0.5 text-sm">
          <button onClick={() => setDirection('debit')} className={`flex-1 rounded-full py-2 ${direction === 'debit' ? 'bg-surface shadow-sm font-medium text-debit' : 'text-muted'}`}>
            Expense
          </button>
          <button onClick={() => setDirection('credit')} className={`flex-1 rounded-full py-2 ${direction === 'credit' ? 'bg-surface shadow-sm font-medium text-credit' : 'text-muted'}`}>
            Income
          </button>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Amount (₹)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus className="input tabular" />
        </div>

        <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
          <div>
            <label className="block text-xs text-muted mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={direction === 'credit' ? 'e.g. Freelance payment' : 'e.g. Groceries'} className="input" />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Category</label>
          <CategoryDropdown
            categories={categories}
            value={{ categoryId: categoryId ? Number(categoryId) : null, subcategoryId: subcategoryId ? Number(subcategoryId) : null }}
            onChange={(v) => {
              setCategoryId(v.categoryId ? String(v.categoryId) : '');
              setSubcategoryId(v.subcategoryId ? String(v.subcategoryId) : '');
            }}
            placeholder="Pick a category"
          />
        </div>

        {error && <div className="text-xs text-debit">{error}</div>}

        <button onClick={submit} disabled={busy} className="btn-primary w-full py-3">
          {busy ? 'Saving…' : `Add ${direction === 'credit' ? 'income' : 'expense'}`}
        </button>
      </div>
    </div>
  );
}
