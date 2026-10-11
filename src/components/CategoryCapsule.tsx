'use client';

import Icon from './Icon';
import { categoryStyle } from '@/lib/palette';

/**
 * Category chip shaped as a two-tone capsule: a light body carrying the
 * category's icon and name, and a solid segment on the right holding the
 * subcategory. The solid end is what makes the subcategory readable at a
 * glance — the previous version rendered it as another pale pill inside a pale
 * pill, so the two levels blurred together.
 */
export default function CategoryCapsule({
  category,
  subcategory,
  isExpense = true,
  locked = false,
  size = 'md',
}: {
  category: string | null;
  subcategory?: string | null;
  isExpense?: boolean;
  locked?: boolean;
  size?: 'sm' | 'md';
}) {
  if (!category) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-dashed border-border font-bold text-muted ${
          size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        }`}
      >
        Uncategorized
      </span>
    );
  }

  const st = categoryStyle(category, isExpense);
  const pad = size === 'sm' ? 'pl-2.5 pr-3 py-1 text-[11px]' : 'pl-3 pr-3.5 py-1.5 text-xs';
  const tailPad = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';

  return (
    <span
      className="inline-flex items-center overflow-hidden rounded-full bg-surface align-middle shadow-sm"
      style={{ boxShadow: `inset 0 0 0 1px ${st.solid}2e, 0 1px 2px rgb(26 28 31 / 0.06)` }}
    >
      <span className={`inline-flex items-center gap-1.5 font-bold ${pad}`} style={{ color: st.ink }}>
        <Icon name={st.icon} size={size === 'sm' ? 12 : 14} style={{ color: st.solid }} />
        {category}
        {locked && <Icon name="lock" size={size === 'sm' ? 10 : 11} />}
      </span>
      {subcategory && (
        <>
          {/* Hairline in the category's own hue, as in the reference. */}
          <span className="h-4 w-px shrink-0" style={{ background: `${st.solid}33` }} />
          <span className={`inline-flex items-center font-bold text-white ${tailPad}`} style={{ background: st.solid }}>
            {subcategory}
          </span>
        </>
      )}
    </span>
  );
}
