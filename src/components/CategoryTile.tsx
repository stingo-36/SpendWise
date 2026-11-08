import Icon from './Icon';
import { categoryStyle, tint, shade } from '@/lib/palette';
import { categoryIcon } from '@/lib/categoryIcons';

/**
 * The icon tile on a transaction row. The big glyph is the subcategory's
 * (Cafes → coffee), on the category's colour with a soft diagonal sheen; a
 * small white badge in the corner carries the parent category's glyph, so
 * "Food › Cafes" and "Bills › Mobile" read apart at a glance.
 */
export default function CategoryTile({
  categoryName,
  categoryIcon: catPick,
  subcategoryName,
  subcategoryIcon: subPick,
  isExpense = true,
  size = 44,
}: {
  categoryName: string | null;
  categoryIcon?: string | null;
  subcategoryName?: string | null;
  subcategoryIcon?: string | null;
  isExpense?: boolean;
  size?: number;
}) {
  const st = categoryStyle(categoryName, isExpense);
  const solid = categoryName ? st.solid : '#0D1014';
  const glyph = categoryIcon({ categoryName, categoryIcon: catPick, subcategoryName, subcategoryIcon: subPick, isExpense });
  // Badge only when the big glyph is the subcategory's own, else it would repeat.
  const parent = catPick || st.icon;
  const showBadge = !!categoryName && !!subcategoryName && glyph !== parent;
  const badge = Math.round(size * 0.42);

  return (
    <span className="relative inline-grid shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span
        className="grid h-full w-full place-items-center rounded-[34%] text-white"
        style={{ background: `linear-gradient(140deg, ${tint(solid, 0.22)} 0%, ${solid} 55%, ${shade(solid, 0.18)} 100%)` }}
      >
        <Icon name={glyph} size={Math.round(size * 0.46)} strokeWidth={2.1} />
      </span>
      {showBadge && (
        <span
          className="absolute -bottom-1 -right-1 grid place-items-center rounded-full border-2 border-white bg-white"
          style={{ width: badge, height: badge, color: shade(solid, 0.1) }}
        >
          <Icon name={parent} size={Math.round(badge * 0.62)} strokeWidth={2.4} />
        </span>
      )}
    </span>
  );
}
