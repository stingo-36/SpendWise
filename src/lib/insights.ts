/**
 * The long view: twelve months of money in vs spend, which categories moved,
 * and where the year's money went. Uses the same rules as the monthly
 * overview (lib/reporting.ts) so the numbers agree with Home:
 *   - spend = effective is_expense debits, card and account alike;
 *   - money in = credits to the account that aren't a transfer to yourself;
 *   - saved = money in − debits that left the account.
 */
import { prisma } from './db';
import { expenseFlagMap, selfTransferCategoryIds } from './reporting';

export interface InsightsMonth {
  month: string; // YYYY-MM
  moneyIn: number;
  spend: number;
  accountOutflow: number;
}

export interface CategoryMover {
  name: string;
  current: number;
  average: number;
  /** Percent change of `current` against `average`. */
  changePct: number;
}

export interface Insights {
  months: InsightsMonth[];
  avgSpend: number;
  /** Mean saved share across months that had money in; null when none did. */
  avgSavedPct: number | null;
  biggest: { month: string; spend: number } | null;
  movers: CategoryMover[];
  topMerchants: { merchant: string; amount: number }[];
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const round = (n: number) => Math.round(n * 100) / 100;

export async function getInsights(userId: number, count = 12, now = new Date()): Promise<Insights> {
  const start = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [flags, selfTransferIds, txns] = await Promise.all([
    expenseFlagMap(),
    selfTransferCategoryIds(),
    prisma.transaction.findMany({
      where: { userId, occurredAt: { gte: start, lt: end } },
      select: {
        amount: true,
        direction: true,
        occurredAt: true,
        categoryId: true,
        subcategoryId: true,
        isCreditCard: true,
        merchant: true,
        displayLabel: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
      },
    }),
  ]);

  const keys: string[] = [];
  for (let i = 0; i < count; i++) keys.push(key(new Date(start.getFullYear(), start.getMonth() + i, 1)));
  const byMonth = new Map(keys.map((k) => [k, { month: k, moneyIn: 0, spend: 0, accountOutflow: 0 }]));
  // category label → month → amount
  const catMonth = new Map<string, Map<string, number>>();
  const merchants = new Map<string, number>();

  for (const t of txns) {
    const m = byMonth.get(key(t.occurredAt));
    if (!m) continue;
    const amt = Number(t.amount);
    if (t.direction === 'credit') {
      const isTransferIn =
        (t.subcategoryId != null && selfTransferIds.has(t.subcategoryId)) || (t.categoryId != null && selfTransferIds.has(t.categoryId));
      if (!t.isCreditCard && !isTransferIn) m.moneyIn += amt;
      continue;
    }
    if (!t.isCreditCard) m.accountOutflow += amt;
    const effId = t.subcategoryId ?? t.categoryId;
    const isExpense = effId == null ? true : flags.get(effId) ?? true;
    if (!isExpense) continue;
    m.spend += amt;
    const label = t.category ? (t.subcategory ? `${t.category.name} › ${t.subcategory.name}` : t.category.name) : 'Uncategorized';
    const row = catMonth.get(label) ?? new Map<string, number>();
    row.set(m.month, (row.get(m.month) ?? 0) + amt);
    catMonth.set(label, row);
    const merchant = t.displayLabel || t.merchant;
    merchants.set(merchant, (merchants.get(merchant) ?? 0) + amt);
  }

  const months = keys.map((k) => {
    const m = byMonth.get(k)!;
    return { month: k, moneyIn: round(m.moneyIn), spend: round(m.spend), accountOutflow: round(m.accountOutflow) };
  });
  const active = months.filter((m) => m.spend > 0 || m.moneyIn > 0);
  const avgSpend = active.length ? round(active.reduce((s, m) => s + m.spend, 0) / active.length) : 0;
  const withIncome = months.filter((m) => m.moneyIn > 0);
  const avgSavedPct = withIncome.length
    ? Math.round(withIncome.reduce((s, m) => s + ((m.moneyIn - m.accountOutflow) / m.moneyIn) * 100, 0) / withIncome.length)
    : null;
  const biggest = active.length ? active.reduce((a, b) => (b.spend > a.spend ? b : a)) : null;

  // This month against the six before it. Skip categories too small to matter
  // so a ₹40 → ₹120 jump doesn't top the list at +200%.
  const current = keys[keys.length - 1];
  const prior = keys.slice(-7, -1);
  const movers: CategoryMover[] = [];
  for (const [name, row] of Array.from(catMonth.entries())) {
    const cur = row.get(current) ?? 0;
    const average = prior.reduce((s, k) => s + (row.get(k) ?? 0), 0) / prior.length;
    if (average < 500 && cur < 500) continue;
    const changePct = average > 0 ? Math.round(((cur - average) / average) * 100) : 100;
    movers.push({ name, current: round(cur), average: round(average), changePct });
  }
  movers.sort((a, b) => Math.abs(b.current - b.average) - Math.abs(a.current - a.average));

  const topMerchants = Array.from(merchants.entries())
    .map(([merchant, amount]) => ({ merchant, amount: round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    months,
    avgSpend,
    avgSavedPct,
    biggest: biggest ? { month: biggest.month, spend: biggest.spend } : null,
    movers: movers.slice(0, 8),
    topMerchants,
  };
}
