'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { ICON_CHOICES } from '@/lib/categoryIcons';

/**
 * Choose an icon for a category. "Auto" (null) keeps guessing from the name,
 * and shows what that guess is right now; any other pick is stored.
 */
export default function IconPicker({
  value,
  suggested,
  color,
  onChange,
  label = 'Icon',
  size = 44,
}: {
  value: string | null;
  /** What "Auto" would show for the current name. */
  suggested: string;
  color: string;
  onChange: (icon: string | null) => void;
  label?: string;
  /** Button size in px. */
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const shown = value ?? suggested;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid place-items-center rounded-[34%] text-white transition-transform hover:scale-105 active:scale-95"
        style={{ background: color, width: size, height: size }}
        aria-label={`${label}: ${shown}${value ? '' : ' (automatic)'} — change`}
        aria-expanded={open}
        title="Choose an icon"
      >
        <Icon name={shown} size={Math.round(size * 0.46)} strokeWidth={2.1} />
      </button>

      {open && (
        <div className="animate-pop absolute left-0 top-full z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border-[1.5px] border-[rgb(var(--ink))] bg-white p-3">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`mb-2 flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm font-semibold ${value == null ? 'bg-[rgb(var(--ink))] text-white' : 'hover:bg-surface-2'}`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: color }}>
              <Icon name={suggested} size={14} />
            </span>
            Auto — match the name
          </button>
          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {ICON_CHOICES.map((g) => (
              <div key={g.group}>
                <div className="eyebrow mb-1">{g.group}</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {g.icons.map((name) => {
                    const on = value === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { onChange(name); setOpen(false); }}
                        className={`grid aspect-square place-items-center rounded-xl transition-colors ${on ? 'text-white' : 'text-[rgb(var(--ink))] hover:bg-surface-2'}`}
                        style={on ? { background: color } : undefined}
                        aria-label={name}
                        aria-pressed={on}
                        title={name}
                      >
                        <Icon name={name} size={18} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
