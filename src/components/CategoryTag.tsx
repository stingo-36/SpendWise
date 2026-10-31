'use client';

import Icon from './Icon';
import { categoryStyle } from '@/lib/palette';

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
}: {
  category: string | null;
  subcategory?: string | null;
  isExpense?: boolean;
  locked?: boolean;
}) {
  if (!category) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#E8833A]/60 px-2 py-0.5 text-xs font-semibold text-[#8A3109]">
        Needs category
      </span>
    );
  }
  const st = categoryStyle(category, isExpense);
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: st.soft, color: st.ink }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: st.solid }} />
      <span className="truncate">
        {category}
        {subcategory && <span className="font-medium"> › {subcategory}</span>}
      </span>
      {locked && <Icon name="lock" size={10} className="shrink-0" />}
    </span>
  );
}
