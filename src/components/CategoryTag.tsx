'use client';

import Icon from './Icon';
import { categoryStyle } from '@/lib/palette';
import { categoryIcon } from '@/lib/categoryIcons';

/**
 * Compact, flat category label for dense lists: a tinted tag with a colour
 * dot, "Category › Subcategory". CategoryCapsule is the larger two-tone
 * version for places with room to spare.
 */
export default function CategoryTag({
  category,
  subcategory,
  isExpense = true,
  locked = false,
  categoryIcon: catPick,
  subcategoryIcon: subPick,
}: {
  category: string | null;
  subcategory?: string | null;
  categoryIcon?: string | null;
  subcategoryIcon?: string | null;
  isExpense?: boolean;
  locked?: boolean;
}) {
  if (!category) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFEDD5] px-2 py-0.5 text-xs font-semibold text-[#9A3412]">
        Needs category
      </span>
    );
  }
  const st = categoryStyle(category, isExpense);
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: st.soft, color: st.ink }}>
      <Icon
        name={categoryIcon({ categoryName: category, categoryIcon: catPick, subcategoryName: subcategory, subcategoryIcon: subPick, isExpense })}
        size={12}
        strokeWidth={2.2}
        className="shrink-0"
        style={{ color: st.solid }}
      />
      <span className="truncate">
        {category}
        {subcategory && <span className="font-medium"> › {subcategory}</span>}
      </span>
      {locked && <Icon name="lock" size={10} className="shrink-0" />}
    </span>
  );
}
