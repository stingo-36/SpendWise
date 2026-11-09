'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import Select from './Select';
import IconPicker from './IconPicker';
import { categoryStyle } from '@/lib/palette';
import { categoryIcon, iconForName } from '@/lib/categoryIcons';

interface Sub { id: number; name: string; icon?: string | null }
interface Cat { id: number; name: string; isExpense: boolean; icon?: string | null; subcategories: Sub[] }

/** What a top-level category shows: your pick, else its built-in/guessed icon. */
const topIcon = (c: { name: string; isExpense: boolean; icon?: string | null }) =>
  c.icon || categoryStyle(c.name, c.isExpense).icon || iconForName(c.name) || 'other';

export default function CategoryManager() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState<string | null>(null);
  const [newIsExpense, setNewIsExpense] = useState(true);
  const [subParent, setSubParent] = useState('');
  const [subName, setSubName] = useState('');
  const [subIcon, setSubIcon] = useState<string | null>(null);
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
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addTop() {
    if (!newName.trim()) return setMsg('Enter a category name.');
    if (await create({ name: newName.trim(), isExpense: newIsExpense, icon: newIcon }, `Added “${newName.trim()}”.`)) {
      setNewName('');
      setNewIcon(null);
    }
  }
  async function addSub() {
    if (!subParent || !subName.trim()) return setMsg('Pick a parent and enter a subcategory name.');
    if (await create({ name: subName.trim(), parentId: Number(subParent), icon: subIcon }, `Added subcategory “${subName.trim()}”.`)) {
      setSubName('');
      setSubIcon(null);
    }
  }
  async function setIcon(id: number, icon: string | null) {
    // Optimistic: the tile changes at once, and reloads from the server after.
    setCats((cs) =>
      cs.map((c) => (c.id === id ? { ...c, icon } : { ...c, subcategories: c.subcategories.map((s) => (s.id === id ? { ...s, icon } : s)) })),
    );
    const res = await fetch(`/api/categories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ icon }) });
    if (!res.ok) setMsg(`Couldn't change the icon (${res.status})`);
    await load();
  }
  async function remove(id: number, name: string) {
    if (!confirm(`Delete “${name}”? Transactions using it become uncategorized.`)) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    await load();
  }

  const parent = cats.find((c) => String(c.id) === subParent);
  const parentColor = parent ? categoryStyle(parent.name, parent.isExpense).solid : '#0D1014';
  const newColor = newName.trim() ? categoryStyle(newName.trim(), newIsExpense).solid : '#0D1014';

  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="h-section">Categories &amp; subcategories</h2>
        <p className="text-xs text-muted">Create your own and pick an icon for each, or leave it on Auto to match the name. Tap any icon to change it.</p>
      </div>

      {/* Add top-level */}
      <div className="grid grid-cols-[auto_1fr] items-end gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
        <div>
          <label className="mb-1 block text-xs text-muted">Icon</label>
          <IconPicker
            value={newIcon}
            suggested={iconForName(newName) || 'other'}
            color={newColor}
            onChange={setNewIcon}
            label="New category icon"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">New category</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTop()} placeholder="e.g. Fitness" className="input" />
        </div>
        <label className="col-span-2 flex items-center gap-1.5 pb-2 text-sm text-muted sm:col-span-1">
          <input type="checkbox" checked={newIsExpense} onChange={(e) => setNewIsExpense(e.target.checked)} /> Money going out (an expense)
        </label>
        <button onClick={addTop} disabled={busy} className="btn-primary col-span-2 sm:col-span-1">Add</button>
      </div>

      {/* Add subcategory */}
      <div className="grid grid-cols-[auto_1fr] items-end gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_auto_1fr_auto]">
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-xs text-muted">Subcategory of</label>
          <Select
            value={subParent}
            onChange={setSubParent}
            placeholder="Pick a category"
            options={cats.map((c) => {
              const st = categoryStyle(c.name, c.isExpense);
              return { value: String(c.id), label: c.name, icon: topIcon(c), tone: st.solid, hint: c.isExpense ? undefined : 'Income' };
            })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Icon</label>
          <IconPicker
            value={subIcon}
            suggested={categoryIcon({ categoryName: parent?.name ?? null, categoryIcon: parent?.icon, subcategoryName: subName, isExpense: parent?.isExpense })}
            color={parentColor}
            onChange={setSubIcon}
            label="New subcategory icon"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">New subcategory</label>
          <input value={subName} onChange={(e) => setSubName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="e.g. Gym" className="input" />
        </div>
        <button onClick={addSub} disabled={busy} className="btn-outline col-span-2 sm:col-span-1">Add sub</button>
      </div>

      {msg && <div className="text-xs font-semibold text-credit">{msg}</div>}

      {/* Existing */}
      <div className="space-y-2.5 border-t border-border pt-4">
        {cats.map((c) => {
          const color = categoryStyle(c.name, c.isExpense).solid;
          return (
            <div key={c.id} className="rounded-2xl border-[1.5px] border-[rgb(var(--ink))] p-3">
              <div className="flex items-center gap-3">
                <IconPicker
                  value={c.icon ?? null}
                  suggested={categoryStyle(c.name, c.isExpense).icon || iconForName(c.name) || 'other'}
                  color={color}
                  onChange={(icon) => setIcon(c.id, icon)}
                  label={`${c.name} icon`}
                  size={38}
                />
                <span className="flex flex-1 items-center gap-2 text-sm font-bold">
                  {c.name}
                  {!c.isExpense && (
                    <span className="badge" style={{ ['--tone-soft']: '#DCFCE7', ['--tone-ink']: '#166534' } as React.CSSProperties}>
                      <Icon name="income" size={10} /> Income
                    </span>
                  )}
                </span>
                <button onClick={() => remove(c.id, c.name)} className="text-xs font-semibold text-muted hover:text-debit">Delete</button>
              </div>
              {c.subcategories.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {c.subcategories.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-1 text-xs font-semibold">
                      <IconPicker
                        value={s.icon ?? null}
                        suggested={categoryIcon({ categoryName: c.name, categoryIcon: c.icon, subcategoryName: s.name, isExpense: c.isExpense })}
                        color={color}
                        onChange={(icon) => setIcon(s.id, icon)}
                        label={`${s.name} icon`}
                        size={24}
                      />
                      {s.name}
                      <button onClick={() => remove(s.id, s.name)} className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-[#EF4444] hover:text-white" aria-label={`Delete ${s.name}`}>
                        <Icon name="close" size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
