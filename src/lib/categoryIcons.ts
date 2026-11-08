/**
 * Which icon a category or subcategory shows.
 *
 * Order of preference:
 *   1. the icon you picked for the subcategory,
 *   2. an icon guessed from the subcategory's name ("Cafes" → coffee),
 *   3. the icon you picked for the parent category,
 *   4. an icon guessed from the parent's name / the built-in category icon,
 *   5. a generic one.
 * Guessing from the name means a new "Gym" subcategory gets a dumbbell
 * without anyone choosing it. Pure and client-safe.
 */
import { categoryStyle } from './palette';

/** First matching rule wins, so put the more specific words first. */
const RULES: [RegExp, string][] = [
  [/flight|air ?line|plane|airport/, 'plane'],
  [/withdraw|\batm\b|\bcash\b/, 'cash'],
  [/credit card|\bcc\b|card bill/, 'creditcard'],
  [/caf[eé]|coffee|\btea\b|bakery|chai/, 'coffee'],
  [/grocer|supermarket|\bmart\b|vegetable|fruit|kirana/, 'basket'],
  [/deliver|takeaway|swiggy|zomato/, 'scooter'],
  [/hotel|restaurant|dining|dine|eat ?out|\bbar\b|\bpub\b/, 'chef'],
  [/mobile|phone|recharge|postpaid|prepaid/, 'mobile'],
  [/broadband|internet|wi-?fi|fiber|fibre/, 'wifi'],
  [/electric|power|\bbescom\b/, 'bolt'],
  [/\bdth\b|\btv\b|cable|television/, 'tv'],
  [/subscri|\bott\b|netflix|spotify|stream|prime/, 'play'],
  [/\bcab|taxi|uber|\bola\b|\bauto\b|rapido/, 'car'],
  [/fuel|petrol|diesel|\bgas\b|\bcng\b|\bev\b|charging/, 'fuel'],
  [/\bbus\b|train|metro|rail|public transport|commute/, 'train'],
  [/toll|parking|fastag/, 'parking'],
  [/cloth|apparel|fashion|shoe|wear/, 'shirt'],
  [/electronic|gadget|laptop|computer|appliance/, 'laptop'],
  [/online|amazon|flipkart|order|ecommerce/, 'package'],
  [/personal care|salon|groom|beauty|\bspa\b|haircut|cosmetic/, 'scissors'],
  [/\brent\b|lease|deposit for flat/, 'key'],
  [/repair|plumb|fix/, 'wrench'],
  [/maint|society|cleaning|paint/, 'roller'],
  [/loan|incred|mortgage|\bemi\b/, 'bank'],
  [/bnpl|pay ?later|simpl|lazypay|snapmint/, 'receipt'],
  [/stock|share|equity|trading|demat/, 'stocks'],
  [/mutual|fund|\bsip\b|\bnps\b/, 'pie'],
  [/recurring deposit|\brd\b|\bfd\b|fixed deposit|saving/, 'piggy'],
  [/people|friend|family|person|parent/, 'user'],
  [/to self|own account|\bself\b/, 'transfers'],
  [/gift|donat|charity/, 'gift'],
  [/entertain|movie|film|cinema|concert|game|event/, 'film'],
  [/gym|fitness|sport|yoga|workout/, 'dumbbell'],
  [/pharma|medicine|\bmed/, 'pill'],
  [/health|doctor|hospital|clinic|dental/, 'health'],
  [/educat|course|book|school|tuition|college|learn/, 'book'],
  [/insur|policy|premium/, 'shield'],
  [/salary|payroll/, 'salary'],
  [/bonus|incentive/, 'bonus'],
  [/refund|cashback|reversal/, 'refund'],
  [/interest|dividend/, 'sip'],
  [/uncategor/, 'help'],
];

/** An icon guessed from a name, or null if nothing fits. */
export function iconForName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return null;
  for (const [re, icon] of RULES) if (re.test(n)) return icon;
  return null;
}

/** The icon a transaction row shows — its subcategory's if it has one. */
export function categoryIcon(opts: {
  categoryName?: string | null;
  categoryIcon?: string | null;
  subcategoryName?: string | null;
  subcategoryIcon?: string | null;
  isExpense?: boolean;
}): string {
  const { categoryName, categoryIcon: catPick, subcategoryName, subcategoryIcon: subPick, isExpense = true } = opts;
  if (subPick) return subPick;
  const fromSub = iconForName(subcategoryName);
  if (fromSub) return fromSub;
  if (catPick) return catPick;
  if (!categoryName) return 'help';
  return categoryStyle(categoryName, isExpense).icon || iconForName(categoryName) || 'other';
}

/** Icons offered in the picker, grouped so the grid reads in sections. */
export const ICON_CHOICES: { group: string; icons: string[] }[] = [
  { group: 'Food', icons: ['food', 'coffee', 'basket', 'scooter', 'chef'] },
  { group: 'Getting around', icons: ['car', 'fuel', 'train', 'plane', 'parking', 'transport'] },
  { group: 'Home & bills', icons: ['house', 'key', 'wrench', 'roller', 'bills', 'bolt', 'wifi', 'mobile', 'tv', 'play'] },
  { group: 'Shopping', icons: ['shopping', 'shirt', 'laptop', 'package', 'scissors', 'gift'] },
  { group: 'Money', icons: ['bank', 'emi', 'creditcard', 'receipt', 'stocks', 'pie', 'piggy', 'cash', 'wallet', 'transfers', 'user'] },
  { group: 'Life', icons: ['health', 'pill', 'dumbbell', 'book', 'film', 'shield', 'sparkle', 'other'] },
];

export const ALL_ICON_CHOICES = new Set(ICON_CHOICES.flatMap((g) => g.icons));
