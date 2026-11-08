// Chart/category palette matching the app's design language: muted, warm,
// low-saturation tones that sit on white cards without shouting.
// Generic index-keyed fallback for charts without a category name. Ordered so
// that consecutive entries are far apart in hue, never adjacent shades.
export const PALETTE = [
  '#EF4444', // red
  '#2563EB', // blue
  '#F97316', // orange
  '#16A34A', // green
  '#7C3AED', // violet
  '#EAB308', // gold
  '#0891B2', // cyan
  '#C026D3', // fuchsia
  '#DB2777', // pink
  '#0EA5E9', // sky
  '#65A30D', // lime
  '#EA580C', // deep orange
];

export const INK = '#0D1014';
export const AMBER = '#CBF24A';
export const PERI = '#1D5FC4';
export const CREDIT = '#1D5FC4';
export const DEBIT = '#B4400C';
export const MUTED = '#2B3140';

/* ───────────────────────────────────────────────────────────────────────────
   Category identity — one colour and one icon per category, keyed by NAME.
   Keying by name (not by list index) is what makes a category read the same
   on the donut, the bar chart, the transaction badge and the keyword group.
   Index-keyed colours drifted: "Food" was amber on the pie and periwinkle on
   the bar chart, and the income donut reused the expense colours because both
   lists started at index 0.
   ─────────────────────────────────────────────────────────────────────────── */

/** Deep enough to carry white text; used for dots, fills and solid tiles. */
export interface CategoryStyle {
  /** Saturated hex — chart fills, legend dots, solid tiles. */
  solid: string;
  /** Very light wash of `solid` — badge/chip backgrounds. */
  soft: string;
  /** Darkened `solid` — text and icons sitting on `soft`. Stays ≥4.5:1. */
  ink: string;
  icon: string;
}

/**
 * Expense side: one hue per category, walked around the wheel in roughly even
 * steps at a shared saturation and lightness, so slices read as one system but
 * never as shades of each other.
 *
 * The order below is the hue order, and it is the point: an earlier version put
 * Food, EMI, House and Bills all in the warm quadrant, so a chart showing only
 * those four looked like four tints of terracotta. Categories that commonly
 * appear together must sit far apart on the wheel, not merely be distinct.
 */
const EXPENSE_HUES: Record<string, { solid: string; icon: string }> = {
  emi: { solid: '#EF4444', icon: 'emi' }, //        ~0°   red
  food: { solid: '#F97316', icon: 'food' }, //     ~25°   orange
  bills: { solid: '#EAB308', icon: 'bills' }, //   ~45°   gold
  sip: { solid: '#16A34A', icon: 'sip' }, //      ~142°   green
  house: { solid: '#0891B2', icon: 'house' }, //  ~192°   cyan
  transport: { solid: '#2563EB', icon: 'transport' }, // ~221° blue
  shopping: { solid: '#7C3AED', icon: 'shopping' }, //   ~262° violet
  leisure: { solid: '#C026D3', icon: 'shopping' }, //    ~292° fuchsia
  health: { solid: '#DB2777', icon: 'health' }, // ~333°  pink
  // No grey: the catch-alls get colours of their own.
  other: { solid: '#65A30D', icon: 'other' }, //        ~85°   lime
  uncategorized: { solid: '#0D1014', icon: 'other' }, //       ink
};

/** Income side: deliberately a different family (greens/teals/violets) so an
 *  income slice can never be mistaken for the expense slice in the same seat. */
const INCOME_HUES: Record<string, { solid: string; icon: string }> = {
  salary: { solid: '#059669', icon: 'salary' },
  bonus: { solid: '#16A34A', icon: 'bonus' },
  extra: { solid: '#0891B2', icon: 'extra' },
  refund: { solid: '#2563EB', icon: 'refund' },
  interest: { solid: '#7C3AED', icon: 'sip' },
  transfers: { solid: '#4F46E5', icon: 'transfers' },
};

/** Fallbacks, so an unseeded or user-added category still gets a stable look. */
// Spans the whole wheel too, so a user-added category (Leisure was one) can't
// land in the warm quadrant just because the fallback pool was warm.
const EXPENSE_FALLBACK = ['#C026D3', '#16A34A', '#2563EB', '#F97316', '#7C3AED', '#EAB308', '#0891B2', '#DB2777'];
const INCOME_FALLBACK = ['#059669', '#0891B2', '#16A34A', '#2563EB', '#7C3AED', '#0D9488'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Mix `hex` toward white by `amount` (0 = unchanged, 1 = white). */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = rgbOf(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Mix `hex` toward black by `amount`. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = rgbOf(hex);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * The colour + icon for a category, stable across every chart and badge.
 * `isExpense` picks which family to fall back into for unknown names, so a
 * user-added income category never lands on an expense colour.
 */
export function categoryStyle(name: string | null | undefined, isExpense = true): CategoryStyle {
  const key = (name ?? 'uncategorized').trim().toLowerCase();
  const known = EXPENSE_HUES[key] ?? INCOME_HUES[key];
  let solid: string;
  let icon: string;
  if (known) {
    solid = known.solid;
    icon = known.icon;
  } else {
    const pool = isExpense ? EXPENSE_FALLBACK : INCOME_FALLBACK;
    solid = pool[hash(key) % pool.length];
    icon = isExpense ? 'other' : 'salary';
  }
  // A clearly coloured wash with deep same-hue text — the old 88% tint read
  // as pale-on-pale and dull.
  return { solid, soft: tint(solid, 0.8), ink: shade(solid, 0.45), icon };
}

/** Convenience for charts, which only need the fill. */
export function categoryColor(name: string | null | undefined, isExpense = true): string {
  return categoryStyle(name, isExpense).solid;
}

/* ── Editorial copy + decoration ────────────────────────────────────────── */

/** One-line description shown under a category heading. */
const BLURBS: Record<string, string> = {
  food: 'Restaurants, cafes, groceries & more',
  emi: 'Loans & Buy Now Pay Later',
  sip: 'Mutual funds & investment platforms',
  transport: 'Cabs, fuel, tolls & travel',
  shopping: 'Online orders, clothing & electronics',
  house: 'Rent, maintenance & repairs',
  bills: 'Utilities, mobile & subscriptions',
  health: 'Medical, pharmacy & fitness',
  other: 'Everything that fits nowhere else',
  transfers: 'Money moved between accounts — not spend',
  salary: 'Regular pay from your employer',
  bonus: 'One-off payouts & incentives',
  extra: 'Side income and windfalls',
  refund: 'Money coming back to you',
};

export function categoryBlurb(name: string | null | undefined): string {
  return BLURBS[(name ?? '').trim().toLowerCase()] ?? 'Keywords filed under this category';
}

/**
 * Glyphs for the watermark cluster in a category card's top-right corner.
 * Purely decorative — three related icons so the card reads as that category
 * before you get to the text.
 */
const DECOR: Record<string, string[]> = {
  food: ['food', 'shopping', 'bills'],
  emi: ['creditcard', 'emi', 'piggy'],
  sip: ['sip', 'overview', 'budget'],
  transport: ['transport', 'wallet', 'calendar'],
  shopping: ['shopping', 'receipt', 'creditcard'],
  house: ['house', 'bills', 'wallet'],
  bills: ['bills', 'receipt', 'repeat'],
  health: ['health', 'receipt', 'wallet'],
  other: ['other', 'receipt', 'wallet'],
  transfers: ['transfers', 'wallet', 'income'],
  salary: ['salary', 'income', 'piggy'],
  bonus: ['bonus', 'extra', 'income'],
  extra: ['extra', 'income', 'piggy'],
};

export function categoryDecor(name: string | null | undefined, isExpense = true): string[] {
  const key = (name ?? '').trim().toLowerCase();
  return DECOR[key] ?? (isExpense ? ['wallet', 'receipt', 'budget'] : ['income', 'piggy', 'salary']);
}
