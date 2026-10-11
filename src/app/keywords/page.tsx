'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCategories } from '@/lib/useCategories';
import { categoryStyle, categoryBlurb, categoryDecor } from '@/lib/palette';
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
  hitCount: number;
}

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

  const byCategory = useMemo(() => {
    const m = new Map<string, Rule[]>();
    for (const r of rules) {
      const k = r.categoryName || 'Uncategorized';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    // Sort within a category: grouped by subcategory, alphabetical inside each,
    // and rules with no subcategory last — the list arrived in insertion order,
    // so a new keyword landed wherever it happened to be created.
    for (const list of m.values()) {
      list.sort((a, b) => {
        const as = a.subcategoryName ?? '\uffff';
        const bs = b.subcategoryName ?? '\uffff';
        if (as !== bs) return as.localeCompare(bs);
        return a.pattern.localeCompare(b.pattern);
      });
    }
    const order = categories.map((c) => c.name);
    return Array.from(m.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [rules, categories]);

  const isExpenseOf = (name: string) => categories.find((c) => c.name === name)?.isExpense ?? true;

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <h1 className="h-page">Keywords</h1>
        <p className="text-sm text-muted mt-1">
          Map keywords to categories. If a transaction’s merchant contains the keyword, it’s filed automatically —
          e.g. <span className="font-semibold text-text">hotel, restaurant, bar</span> → Food.
        </p>
      </header>

      {/* Add form — category and subcategory in one dropdown. */}
      <section className="card animate-fade-up relative z-30 p-4 sm:p-5" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Keyword</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="e.g. restaurant"
              className="input"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Files into</label>
            <CategoryDropdown categories={categories} value={picked} onChange={setPicked} placeholder="Pick a category" />
          </div>
          <button onClick={add} disabled={busy || picked.categoryId == null} className="btn-primary">
            <Icon name="plus" size={15} /> {busy ? 'Adding…' : 'Add keyword'}
          </button>
        </div>

        {msg && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
              msg.ok ? 'bg-mint text-[rgb(var(--credit))]' : 'bg-blush text-[rgb(var(--debit))]'
            }`}
          >
            <Icon name={msg.ok ? 'check' : 'alert'} size={14} /> {msg.text}
          </div>
        )}
      </section>

      {/* Existing rules grouped by category */}
      <div className="space-y-4">
        {byCategory.map(([cat, list], idx) => {
          const isExpense = isExpenseOf(cat);
          const st = categoryStyle(cat, isExpense);
          const decor = categoryDecor(cat, isExpense);
          return (
            <section
              key={cat}
              className="card animate-fade-up relative overflow-hidden"
              style={{ animationDelay: `${120 + idx * 50}ms` }}
            >
              {/* Left accent stripe — the category's colour running the card. */}
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: st.solid }} aria-hidden />

              {/* Watermark cluster: the category's own glyphs, faint, sitting
                  beside the heading rather than behind the chip panel. */}
              <div
                className="pointer-events-none absolute right-5 top-2 hidden select-none items-end gap-3 md:flex"
                style={{ color: st.solid }}
                aria-hidden
              >
                <Icon name={decor[2]} size={44} className="opacity-[0.09]" strokeWidth={1.2} />
                <Icon name={decor[1]} size={62} className="opacity-[0.11]" strokeWidth={1.1} />
                <Icon name={decor[0]} size={80} className="opacity-[0.13]" strokeWidth={1} />
              </div>

              <div className="relative p-4 pl-5 sm:p-5 sm:pl-6">
                <div className="flex items-center gap-3">
                  <span className="tile h-12 w-12 shrink-0 text-white shadow-sm" style={{ background: st.solid }}>
                    <Icon name={st.icon} size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="h-section" style={{ color: st.ink }}>{cat}</h2>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                        style={{ background: st.solid }}
                      >
                        {list.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-muted">{categoryBlurb(cat)}</p>
                  </div>
                </div>

                {/* Chips sit on their own panel so they stay legible over the
                    tint and the watermark behind the card. */}
                <div className="mt-4 rounded-2xl bg-surface-2/60 p-2 sm:p-3">
                  <div className="flex flex-wrap gap-2">
                    {list.map((r) => (
                      <span
                        key={r.id}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-surface py-1.5 pl-2.5 pr-1.5 text-[13px] font-bold transition-all hover:-translate-y-px sm:gap-2 sm:pl-3 sm:text-sm"
                        style={{ color: st.ink, boxShadow: `inset 0 0 0 1.5px ${st.solid}33, 0 1px 2px rgb(26 28 31 / 0.05)` }}
                      >
                        <Icon name={st.icon} size={13} style={{ color: st.solid }} />
                        <span className="lowercase">{r.pattern}</span>
                        {r.subcategoryName && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: st.soft, color: st.ink }}
                          >
                            {r.subcategoryName}
                          </span>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          className="grid h-5 w-5 place-items-center rounded-full text-muted transition-colors hover:bg-debit hover:text-white"
                          aria-label={`Remove ${r.pattern}`}
                        >
                          <Icon name="close" size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
