'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from './Icon';
import { categoryStyle } from '@/lib/palette';
import { categoriesForSide, type CategoryOpt } from '@/lib/useCategories';

/**
 * Shared dropdown shell. Every dropdown on the site renders through this, so
 * they all get the same field, popover, motion and palette — native `<select>`
 * opened an OS menu that ignored the app's design entirely.
 */
function Popover({
  field,
  children,
  align = 'left',
  width = 'w-full min-w-[16rem]',
}: {
  field: (p: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  // Flip above the field when there isn't room below — a dropdown opened on a
  // row near the bottom of the page otherwise ran off the viewport.
  const [dropUp, setDropUp] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const rect = wrap.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setDropUp(below < 340 && rect.top > below);
    }
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      {field({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={`animate-pop absolute z-40 max-h-[22rem] overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-[0_24px_60px_-24px_rgb(26_28_31/0.45)] ${width} ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** The closed field: icon tile (optional), label, chevron. */
function Field({
  open,
  toggle,
  tone,
  icon,
  label,
  placeholder,
  className = '',
}: {
  open: boolean;
  toggle: () => void;
  tone?: string;
  icon?: string;
  label?: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={toggle} className={`input flex items-center gap-2 text-left ${className}`} aria-haspopup="listbox" aria-expanded={open}>
      {icon && (
        <span
          className="tile h-6 w-6 shrink-0 rounded-lg"
          style={tone ? { background: tone, color: '#fff' } : { background: 'rgb(var(--surface-2))', color: 'rgb(var(--muted))' }}
        >
          <Icon name={icon} size={12} />
        </span>
      )}
      <span className={`flex-1 truncate font-bold ${label ? '' : 'font-semibold text-muted'}`} style={label && tone ? { color: tone } : undefined}>
        {label ?? placeholder}
      </span>
      <Icon name="chevron" size={14} className={`shrink-0 text-muted transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
    </button>
  );
}

export interface Opt {
  value: string;
  label: string;
  hint?: string;
  icon?: string;
  /** Accent hex for the row's tile and selected state. */
  tone?: string;
}

/**
 * Plain single-value dropdown (months, direction filters, parent pickers).
 */
export default function Select({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  icon,
  align = 'left',
  className = '',
  width,
}: {
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
  placeholder?: string;
  /** Leading glyph when the chosen option has none of its own. */
  icon?: string;
  align?: 'left' | 'right';
  className?: string;
  width?: string;
}) {
  const sel = options.find((o) => o.value === value);
  return (
    <Popover
      align={align}
      width={width}
      field={({ open, toggle }) => (
        <Field
          open={open}
          toggle={toggle}
          icon={sel?.icon ?? icon}
          tone={sel?.tone}
          label={sel?.label}
          placeholder={placeholder}
          className={className}
        />
      )}
    >
      {(close) =>
        options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => {
                onChange(o.value);
                close();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
              style={on && o.tone ? { background: `${o.tone}14` } : on ? { background: 'rgb(var(--surface-2))' } : undefined}
            >
              {o.icon && (
                <span
                  className="tile h-6 w-6 shrink-0 rounded-lg"
                  style={o.tone ? { background: o.tone, color: '#fff' } : { background: 'rgb(var(--surface-2))', color: 'rgb(var(--muted))' }}
                >
                  <Icon name={o.icon} size={12} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold" style={on && o.tone ? { color: o.tone } : undefined}>{o.label}</span>
                {o.hint && <span className="block truncate text-[11px] font-medium text-muted">{o.hint}</span>}
              </span>
              {on && <Icon name="check" size={15} className="shrink-0" style={o.tone ? { color: o.tone } : undefined} />}
            </button>
          );
        })
      }
    </Popover>
  );
}

/** Month options for the last `count` months, newest first. */
export function monthOpts(count = 12): Opt[] {
  const out: Opt[] = [];
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  for (let i = 0; i < count; i++) {
    const value = `${y}-${String(m + 1).padStart(2, '0')}`;
    out.push({
      value,
      label: new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      icon: 'calendar',
    });
    m--;
    if (m < 0) {
      m = 11;
      y--;
    }
  }
  return out;
}

export interface CategoryValue {
  categoryId: number | null;
  subcategoryId: number | null;
}

/**
 * Category + subcategory in ONE dropdown. Picking a category expands its
 * subcategories inline beneath it, so both levels are chosen without a second
 * field — and a category's children are visible before you commit to it.
 */
export function CategoryDropdown({
  categories,
  value,
  onChange,
  placeholder = 'Pick a category',
  side,
  allowClear = false,
  clearLabel = 'All categories',
  className = '',
}: {
  categories: CategoryOpt[];
  value: CategoryValue;
  onChange: (v: CategoryValue) => void;
  placeholder?: string;
  side?: 'expense' | 'income';
  /** Show a "clear" row — used by filter bars. */
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const visible = side ? categoriesForSide(categories, side) : categories;

  const cat = categories.find((c) => c.id === value.categoryId);
  const sub = cat?.subcategories.find((s) => s.id === value.subcategoryId);
  const st = cat ? categoryStyle(cat.name, cat.isExpense) : null;

  return (
    <Popover
      field={({ open, toggle }) => (
        <Field
          open={open}
          toggle={() => {
            setExpanded(value.categoryId);
            toggle();
          }}
          icon={st?.icon ?? 'keywords'}
          tone={st?.solid}
          label={cat ? `${cat.name}${sub ? ` › ${sub.name}` : ''}` : undefined}
          placeholder={placeholder}
          className={className}
        />
      )}
    >
      {(close) => (
        <>
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange({ categoryId: null, subcategoryId: null });
                close();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-muted transition-colors hover:bg-surface-2"
            >
              {clearLabel}
            </button>
          )}
          {visible.map((c) => {
            const s = categoryStyle(c.name, c.isExpense);
            const isOpen = expanded === c.id;
            const on = value.categoryId === c.id;
            return (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (c.subcategories.length === 0) {
                      onChange({ categoryId: c.id, subcategoryId: null });
                      close();
                    } else {
                      setExpanded(isOpen ? null : c.id);
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
                  style={on ? { background: s.soft } : undefined}
                >
                  <span className="tile h-6 w-6 shrink-0 rounded-lg text-white" style={{ background: s.solid }}>
                    <Icon name={s.icon} size={12} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold" style={on ? { color: s.ink } : undefined}>{c.name}</span>
                    <span className="block truncate text-[11px] font-medium text-muted">
                      {c.isExpense ? '' : 'Income · '}
                      {c.subcategories.length > 0 ? `${c.subcategories.length} subcategories` : 'no subcategories'}
                    </span>
                  </span>
                  {c.subcategories.length > 0 ? (
                    <Icon name="chevron" size={13} className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  ) : (
                    on && <Icon name="check" size={15} className="shrink-0" style={{ color: s.solid }} />
                  )}
                </button>

                {isOpen && c.subcategories.length > 0 && (
                  <div className="mb-1 ml-4 space-y-0.5 border-l-2 pl-2" style={{ borderColor: `${s.solid}33` }}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ categoryId: c.id, subcategoryId: null });
                        close();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-muted transition-colors hover:bg-surface-2"
                    >
                      Just “{c.name}”
                      {on && value.subcategoryId == null && <Icon name="check" size={13} className="ml-auto" style={{ color: s.solid }} />}
                    </button>
                    {c.subcategories.map((sc) => {
                      const scOn = on && value.subcategoryId === sc.id;
                      return (
                        <button
                          key={sc.id}
                          type="button"
                          onClick={() => {
                            onChange({ categoryId: c.id, subcategoryId: sc.id });
                            close();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-bold transition-colors hover:bg-surface-2"
                          style={scOn ? { background: s.soft, color: s.ink } : undefined}
                        >
                          {sc.name}
                          {scOn && <Icon name="check" size={13} className="ml-auto" style={{ color: s.solid }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </Popover>
  );
}
