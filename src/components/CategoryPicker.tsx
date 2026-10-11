'use client';

import Icon from './Icon';
import { categoryStyle } from '@/lib/palette';
import { categoriesForSide, type CategoryOpt } from '@/lib/useCategories';

export interface Picked {
  categoryId: number | null;
  subcategoryId: number | null;
}

/**
 * Always-visible category list.
 *
 * Replaces the native `<select>`, which opened an OS popup: on macOS that's an
 * opaque grey menu that ignores the app's palette, hides how many options
 * there are, and — critically — has no room for subcategories, so a category
 * with five children looked identical to one with none. Here every category is
 * a tile and its subcategories sit right underneath it as chips.
 */
export default function CategoryPicker({
  categories,
  value,
  onChange,
  side,
  columns = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  numbered = false,
}: {
  categories: CategoryOpt[];
  value: Picked;
  onChange: (p: Picked) => void;
  /** Limit to one side of the taxonomy. Omit to show everything. */
  side?: 'expense' | 'income';
  columns?: string;
  /** Show 1-9 keyboard hints (the review queue drives this by keystroke). */
  numbered?: boolean;
}) {
  const visible = side ? categoriesForSide(categories, side) : categories;

  if (visible.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm font-medium text-muted">
        No {side ?? ''} categories yet — add them under{' '}
        <a href="/settings" className="font-semibold text-text underline">Settings</a>.
      </p>
    );
  }

  return (
    <div className={`grid gap-2.5 ${columns}`}>
      {visible.map((c, i) => {
        const st = categoryStyle(c.name, c.isExpense);
        const active = value.categoryId === c.id;
        return (
          <div
            key={c.id}
            className="rounded-2xl border p-2 transition-all"
            style={{
              background: active ? st.soft : 'rgb(var(--surface))',
              borderColor: active ? st.solid : 'rgb(var(--border))',
            }}
          >
            <button
              type="button"
              onClick={() => onChange({ categoryId: c.id, subcategoryId: null })}
              className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors"
            >
              <span className="tile h-8 w-8 shrink-0 rounded-xl text-white" style={{ background: st.solid }}>
                <Icon name={st.icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold" style={{ color: active ? st.ink : 'rgb(var(--text))' }}>
                  {c.name}
                </span>
                <span className="block text-[11px] font-medium text-muted">
                  {c.subcategories.length > 0 ? `${c.subcategories.length} subcategories` : 'no subcategories'}
                </span>
              </span>
              {numbered && i < 9 && (
                <kbd className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-muted">{i + 1}</kbd>
              )}
              {active && <Icon name="check" size={16} style={{ color: st.solid }} />}
            </button>

            {c.subcategories.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 px-1.5 pb-1">
                {c.subcategories.map((s) => {
                  const on = active && value.subcategoryId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChange({ categoryId: c.id, subcategoryId: on ? null : s.id })}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all hover:-translate-y-px"
                      style={
                        on
                          ? { background: st.solid, color: '#fff' }
                          : { background: st.soft, color: st.ink, boxShadow: `inset 0 0 0 1px ${st.solid}33` }
                      }
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
