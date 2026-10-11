'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import Select from './Select';
import { categoryStyle } from '@/lib/palette';

interface Sub { id: number; name: string }
interface Cat { id: number; name: string; isExpense: boolean; subcategories: Sub[] }

export default function CategoryManager() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [newName, setNewName] = useState('');
  const [newIsExpense, setNewIsExpense] = useState(true);
  const [subParent, setSubParent] = useState('');
  const [subName, setSubName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch('/api/categories').then((r) => r.json());
    setCats(d.categories ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setMsg(okMsg);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function addTop() {
    if (!newName.trim()) return setMsg('Enter a category name.');
    await create({ name: newName.trim(), isExpense: newIsExpense }, `Added “${newName.trim()}”.`);
    setNewName('');
  }
  async function addSub() {
    if (!subParent || !subName.trim()) return setMsg('Pick a parent and enter a subcategory name.');
    await create({ name: subName.trim(), parentId: Number(subParent) }, `Added subcategory “${subName.trim()}”.`);
    setSubName('');
  }
  async function remove(id: number, name: string) {
    if (!confirm(`Delete “${name}”? Transactions using it become uncategorized.`)) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Categories &amp; subcategories</h2>
        <p className="text-xs text-muted">Create your own. Shared across the app’s category list.</p>
      </div>

      {/* Add top-level */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div>
          <label className="block text-xs text-muted mb-1">New category</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTop()} placeholder="e.g. Health" className="input" />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted pb-2">
          <input type="checkbox" checked={newIsExpense} onChange={(e) => setNewIsExpense(e.target.checked)} /> Money going out (an expense)
        </label>
        <button onClick={addTop} disabled={busy} className="btn-primary h-[38px]">Add</button>
      </div>

      {/* Add subcategory */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end border-t border-border pt-4">
        <div>
          <label className="block text-xs text-muted mb-1">Subcategory of</label>
          <Select
            value={subParent}
            onChange={setSubParent}
            placeholder="Pick a category"
            options={cats.map((c) => {
              const st = categoryStyle(c.name, c.isExpense);
              return { value: String(c.id), label: c.name, icon: st.icon, tone: st.solid, hint: c.isExpense ? undefined : 'Income' };
            })}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">New subcategory</label>
          <input value={subName} onChange={(e) => setSubName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="e.g. Gym" className="input" />
        </div>
        <button onClick={addSub} disabled={busy} className="btn-outline h-[38px]">Add sub</button>
      </div>

      {msg && <div className="text-xs text-credit">{msg}</div>}

      {/* Existing */}
      <div className="space-y-2 border-t border-border pt-4">
        {cats.map((c) => (
          <div key={c.id} className="rounded-lg bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold">
                {c.name}
                {!c.isExpense && (
                  <span className="badge" style={{ ['--tone-soft']: '#E2F1EA', ['--tone-ink']: '#1E6349' } as React.CSSProperties}>
                    <Icon name="income" size={10} /> Income
                  </span>
                )}
              </span>
              <button onClick={() => remove(c.id, c.name)} className="text-xs text-muted hover:text-debit">Delete</button>
            </div>
            {c.subcategories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.subcategories.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-surface border border-border pl-2.5 pr-1 py-0.5 text-xs">
                    {s.name}
                    <button onClick={() => remove(s.id, s.name)} className="h-4 w-4 rounded-full grid place-items-center text-muted hover:text-debit" aria-label="Delete">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
