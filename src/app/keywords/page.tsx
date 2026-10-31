'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCategories } from '@/lib/useCategories';
import Link from 'next/link';
import CategoryTag from '@/components/CategoryTag';
import { categoryStyle } from '@/lib/palette';
import { CategoryDropdown, type CategoryValue as Picked } from '@/components/Select';
import Icon from '@/components/Icon';

interface Rule {
  id: number;
  pattern: string;
  categoryId: number | null;
  categoryName: string;
  subcategoryId: number | null;
  subcategoryName: string | null;
  label: string | null;
  source: string;
  global: boolean;
  hitCount: number;
}

type SourceTab = 'all' | 'mine' | 'learned' | 'builtin';

/** Built-in = shared seed rules; Mine = added here; Learned = from your corrections. */
function sourceOf(r: Rule): Exclude<SourceTab, 'all'> {
  if (r.global) return 'builtin';
  return r.source === 'manual' ? 'mine' : 'learned';
}

const SOURCE_CHIP: Record<Exclude<SourceTab, 'all'>, { label: string; cls: string }> = {
  mine: { label: 'Mine', cls: 'bg-[rgb(var(--ink))] text-amber' },
  learned: { label: 'Learned', cls: 'bg-sky text-[rgb(var(--peri-2))]' },
  builtin: { label: 'Built-in', cls: 'bg-surface-2 text-muted' },
};

/**
 * Keyword rules: map a keyword to a category. Any transaction whose merchant
 * contains the keyword is filed there automatically — existing and future.
 */
export default function KeywordsPage() {
  const categories = useCategories();
  const [rules, setRules] = useState<Rule[]>([]);
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<Picked>({ categoryId: null, subcategoryId: null });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<SourceTab>('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const d = await fetch('/api/rules').then((r) => r.json());
    setRules(d.rules);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!keyword.trim() || picked.categoryId == null) {
      setMsg({ text: 'Enter a keyword and pick a category below.', ok: false });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), categoryId: picked.categoryId, subcategoryId: picked.subcategoryId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setMsg({ text: `Added “${keyword.trim()}” — applied to ${d.applied ?? 0} existing transaction(s).`, ok: true });
      setKeyword('');
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed', ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    await load();
  }

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rules
      .filter((r) => (tab === 'all' || sourceOf(r) === tab) && (!term || r.pattern.toLowerCase().includes(term) || r.categoryName.toLowerCase().includes(term)))
      .sort((a, b) => b.hitCount - a.hitCount || a.pattern.localeCompare(b.pattern));
  }, [rules, tab, q]);
  const counts = useMemo(() => {
    const c = { all: rules.length, mine: 0, learned: 0, builtin: 0 };
    for (const r of rules) c[sourceOf(r)]++;
    return c;
  }, [rules]);

  const isExpenseOf = (name: string) => categories.find((c) => c.name === name)?.isExpense ?? true;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header>
        <div className="eyebrow">{rules.length} rules · if the merchant contains the keyword, it’s filed automatically</div>
        <h1 className="h-page mt-1.5">Rules</h1>
      </header>

      {/* New rule, written as a sentence. Not overflow-hidden: the category
          menu has to drop out of the panel. */}
      <section className="relative z-30 flex flex-col gap-4 rounded-[20px] bg-[rgb(var(--ink))] p-5 text-white sm:p-6">
        <h2 className="h-section">New rule</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <span className="font-display text-lg font-semibold sm:text-[22px]">When the merchant contains</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="e.g. restaurant"
            aria-label="Keyword"
            className="input w-full text-base text-text sm:w-56"
          />
          <span className="font-display text-lg font-semibold sm:text-[22px]">file it under</span>
          {/* text-text: the menu would otherwise inherit the panel's white text. */}
          <div className="w-full text-base text-text sm:w-64">
            <CategoryDropdown categories={categories} value={picked} onChange={setPicked} placeholder="Pick a category" />
          </div>
          <button onClick={add} disabled={busy || picked.categoryId == null || !keyword.trim()} className="btn-accent w-full px-6 sm:ml-auto sm:w-auto">
            {busy ? 'Saving…' : 'Save rule'}
          </button>
        </div>
        <span className="text-[13px] text-[rgb(var(--sidebar-muted))]">Applies to past payments too, and to every sync after this.</span>
        {msg && (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${msg.ok ? 'bg-white/10 text-amber' : 'bg-blush text-[#8A3109]'}`}>
            <Icon name={msg.ok ? 'check' : 'alert'} size={14} /> {msg.text}
          </div>
        )}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
            <div className="seg" role="tablist" aria-label="Source">
              {(
                [
                  ['all', 'All'],
                  ['mine', 'Mine'],
                  ['learned', 'Learned'],
                  ['builtin', 'Built-in'],
                ] as [SourceTab, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={tab === v}
                  onClick={() => setTab(v)}
                  className={`seg-btn min-h-9 ${tab === v ? 'seg-on' : ''}`}
                >
                  {label} <span className="tabular text-xs text-muted">{counts[v]}</span>
                </button>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rules" aria-label="Search rules" className="input w-full sm:w-56" />
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No rules here yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.07em] text-muted">
                    <th className="px-5 py-2.5 font-semibold">Keyword</th>
                    <th className="px-3 py-2.5 font-semibold">Files into</th>
                    <th className="px-3 py-2.5 font-semibold">Source</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Hits</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((r) => {
                    const src = sourceOf(r);
                    return (
                      <tr key={r.id} className="group hover:bg-surface-2/50">
                        <td className="tabular px-5 py-2.5 font-semibold">{r.pattern}</td>
                        <td className="px-3 py-2.5">
                          <CategoryTag category={r.categoryName || null} subcategory={r.subcategoryName} isExpense={isExpenseOf(r.categoryName)} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`chip ${SOURCE_CHIP[src].cls}`}>{SOURCE_CHIP[src].label}</span>
                        </td>
                        <td className="tabular px-3 py-2.5 text-right text-muted">{r.hitCount}</td>
                        <td className="px-5 py-2.5 text-right">
                          {/* Built-in rules can be removed too (the API allows it). */}
                          {(
                            <button
                              onClick={() => remove(r.id)}
                              className="ml-auto grid h-9 w-9 place-items-center rounded-lg bg-[#FBE3D3] text-[#9A3412] transition-colors hover:bg-debit hover:text-white"
                              aria-label={`Remove ${r.pattern}`}
                              title="Remove"
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="card p-4" aria-label="Categories">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="h-section">Categories</h2>
            <Link href="/settings#categories" className="text-xs font-semibold text-[rgb(var(--peri))] hover:underline">
              Manage →
            </Link>
          </div>
          {/* Two groups instead of a "not spend" chip on every row. */}
          {([
            ['Spending', categories.filter((c) => c.isExpense)],
            ['Not spending · income and transfers', categories.filter((c) => !c.isExpense)],
          ] as const).map(([label, list]) =>
            list.length === 0 ? null : (
              <div key={label} className="mt-4 first:mt-1">
                <div className="eyebrow px-1 pb-1">{label}</div>
                <ul className="flex flex-col gap-2">
                  {list.map((c) => {
                    // Each tile in its category's own colour, as on tags and charts.
                    const st = categoryStyle(c.name, c.isExpense);
                    return (
                      <li key={c.id} className="rounded-2xl border px-3.5 py-3" style={{ background: st.soft, borderColor: `${st.solid}55` }}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold" style={{ color: st.ink }}>
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.solid }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          {c.subcategories.length > 0 && (
                            <span className="tabular shrink-0 rounded-full bg-white/70 px-2 text-xs font-semibold" style={{ color: st.ink }}>
                              {c.subcategories.length}
                            </span>
                          )}
                        </div>
                        {c.subcategories.length > 0 && (
                          <div className="mt-1 text-xs leading-relaxed text-text/70">{c.subcategories.map((sub) => sub.name).join(' · ')}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )}
        </aside>
      </div>
    </div>
  );
}
