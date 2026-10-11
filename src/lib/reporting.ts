/**
 * Reporting aggregations (spec §10). All headline spend figures filter on
 * effective is_expense = true (spec §8.1): moving money between your own
 * accounts, paying a credit card bill, or buying an investment is NOT spend.
 *
 * "Effective" is_expense = the subcategory's flag when a subcategory is set
 * (this is how the Fees & charges override works), else the category's flag.
 * Only debits count as spend.
 */
import { prisma } from './db';

export interface CategoryBreakdownItem {
  categoryId: number | null;
  categoryName: string;
  amount: number;
  isExpense: boolean;
}

export interface MonthlyOverview {
  month: string; // YYYY-MM
  totalSpend: number; // is_expense debits — account AND credit card
  totalMoneyIn: number; // credits landing in the bank account (excludes card refunds)
  allMoneyOut: number; // all debits (the "all money movement" view, §8.1)
  accountOutflow: number; // debits that actually left the bank account
  creditCardSpend: number; // is_expense debits charged to a registered credit card
  prevMonthSpend: number;
  deltaPct: number | null;
  categoryBreakdown: CategoryBreakdownItem[];
  incomeBreakdown: CategoryBreakdownItem[];
  topMerchants: { merchant: string; amount: number }[];
  txnCount: number;
  uncategorizedCount: number;
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

/** Load a map of categoryId → effective is_expense (subcategory overrides). */
async function expenseFlagMap(): Promise<Map<number, boolean>> {
  const cats = await prisma.category.findMany({ select: { id: true, isExpense: true } });
  return new Map(cats.map((c) => [c.id, c.isExpense]));
}

/**
 * Category ids for transfers that are your OWN money moving between your own
 * accounts — currently "Transfers › To self".
 *
 * Transfers are is_expense = false, which already keeps outgoing transfers out
 * of spend, but income shares that flag, so a credit needs this set to tell
 * "money that arrived" from "money you shuffled".
 *
 * Only the self-transfer child qualifies. Excluding the whole Transfers tree
 * also dropped "To self" siblings like "To people" — so ₹100 actually sent to
 * you by another person vanished from Money in and from the income donut, even
 * though it really did land in the account.
 */
async function selfTransferCategoryIds(): Promise<Set<number>> {
  const root = await prisma.category.findFirst({
    where: { name: 'Transfers', parentId: null },
    select: { id: true, children: { select: { id: true, name: true } } },
  });
  if (!root) return new Set();
  return new Set(root.children.filter((c) => /to self/i.test(c.name)).map((c) => c.id));
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface BudgetProgress {
  budgetId: number;
  categoryId: number;
  categoryName: string;
  budget: number;
  spent: number;
}

/** Per-budget spent-vs-cap for a user in a given month (top-level categories). */
export async function getBudgetProgress(userId: number, month: string): Promise<BudgetProgress[]> {
  const budgets = await prisma.budget.findMany({ where: { userId }, include: { category: true } });
  if (budgets.length === 0) return [];

  const { start, end } = monthBounds(month);
  const flags = await expenseFlagMap();
  const txns = await prisma.transaction.findMany({
    where: { userId, direction: 'debit', occurredAt: { gte: start, lt: end } },
    select: { amount: true, categoryId: true, subcategoryId: true },
  });

  const spentByCat = new Map<number, number>();
  for (const t of txns) {
    if (t.categoryId == null) continue;
    const effId = t.subcategoryId ?? t.categoryId;
    if (!(flags.get(effId) ?? true)) continue; // only real expenses
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + Number(t.amount));
  }

  return budgets
    .map((b) => ({
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: b.category.name,
      budget: Number(b.amount),
      spent: Math.round((spentByCat.get(b.categoryId) ?? 0) * 100) / 100,
    }))
    .sort((a, b) => b.budget - a.budget);
}

async function spendForRange(userId: number, start: Date, end: Date, flags: Map<number, boolean>): Promise<number> {
  const txns = await prisma.transaction.findMany({
    where: { userId, direction: 'debit', occurredAt: { gte: start, lt: end } },
    select: { amount: true, categoryId: true, subcategoryId: true },
  });
  let total = 0;
  for (const t of txns) {
    const effId = t.subcategoryId ?? t.categoryId;
    // Uncategorized debits: count as spend (conservative — surfaced for review).
    const isExpense = effId == null ? true : flags.get(effId) ?? true;
    if (isExpense) total += Number(t.amount);
  }
  return total;
}

export interface TrendPoint {
  month: string; // YYYY-MM
  label: string; // e.g. "Aug"
  spend: number; // is_expense debits
  income: number; // credits
}

/**
 * Spend + income per month over the `months` months ending at `endMonth`
 * (inclusive). One query, bucketed in memory.
 */
export async function getTrend(userId: number, endMonth: string, months = 6): Promise<TrendPoint[]> {
  const flags = await expenseFlagMap();
  const [ey, em] = endMonth.split('-').map(Number);
  const end = new Date(ey, em, 1); // exclusive upper bound (first of month after end)
  const start = new Date(ey, em - months, 1);

  const txns = await prisma.transaction.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    select: { amount: true, direction: true, occurredAt: true, categoryId: true, subcategoryId: true, isCreditCard: true },
  });

  // Initialize buckets oldest → newest.
  const buckets = new Map<string, TrendPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ey, em - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { month: key, label: d.toLocaleDateString('en-IN', { month: 'short' }), spend: 0, income: 0 });
  }

  for (const t of txns) {
    const key = `${t.occurredAt.getFullYear()}-${String(t.occurredAt.getMonth() + 1).padStart(2, '0')}`;
    const b = buckets.get(key);
    if (!b) continue;
    const amt = Number(t.amount);
    if (t.direction === 'credit') {
      if (!t.isCreditCard) b.income += amt;
    } else {
      const effId = t.subcategoryId ?? t.categoryId;
      const isExpense = effId == null ? true : flags.get(effId) ?? true;
      if (isExpense) b.spend += amt;
    }
  }

  return Array.from(buckets.values()).map((b) => ({ ...b, spend: Math.round(b.spend), income: Math.round(b.income) }));
}

export interface CategoryWeek {
  label: string; // "1–7"
  total: number;
  /** amount per top-level category name — sparse, only what was spent */
  [category: string]: string | number;
}

export interface WeeklyCategorySpend {
  weeks: CategoryWeek[];
  /** Category names present this month, largest total first — the stack order. */
  categories: string[];
}

/**
 * Spend for the selected month split into calendar weeks and stacked by
 * top-level category. Only is_expense debits count, so transfers and card-bill
 * payments never show up as a band.
 */
export async function getWeeklyCategorySpend(userId: number, month: string): Promise<WeeklyCategorySpend> {
  const flags = await expenseFlagMap();
  const { start, end } = monthBounds(month);
  const [ey, em] = month.split('-').map(Number);
  const daysInMonth = new Date(ey, em, 0).getDate();

  const ranges: [number, number][] = [];
  for (let d = 1; d <= daysInMonth; d += 7) ranges.push([d, Math.min(d + 6, daysInMonth)]);

  const txns = await prisma.transaction.findMany({
    where: { userId, direction: 'debit', occurredAt: { gte: start, lt: end } },
    select: { amount: true, occurredAt: true, categoryId: true, subcategoryId: true, category: { select: { name: true } } },
  });

  const buckets = ranges.map(([a, b]) => ({ label: `${a}\u2013${b}`, byCat: new Map<string, number>(), total: 0 }));
  const totals = new Map<string, number>();

  for (const t of txns) {
    const effId = t.subcategoryId ?? t.categoryId;
    const isExpense = effId == null ? true : flags.get(effId) ?? true;
    if (!isExpense) continue;

    const idx = Math.min(ranges.length - 1, Math.floor((t.occurredAt.getDate() - 1) / 7));
    const name = t.category?.name ?? 'Uncategorized';
    const amt = Number(t.amount);
    const b = buckets[idx];
    b.byCat.set(name, (b.byCat.get(name) ?? 0) + amt);
    b.total += amt;
    totals.set(name, (totals.get(name) ?? 0) + amt);
  }

  // Biggest categories first so the stack reads consistently across weeks.
  const categories = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const weeks = buckets.map((b) => {
    const row: CategoryWeek = { label: b.label, total: Math.round(b.total * 100) / 100 };
    for (const name of categories) row[name] = Math.round((b.byCat.get(name) ?? 0) * 100) / 100;
    return row;
  });

  return { weeks, categories };
}

export async function getMonthlyOverview(userId: number, month: string): Promise<MonthlyOverview> {
  const flags = await expenseFlagMap();
  const selfTransferIds = await selfTransferCategoryIds();
  const { start, end } = monthBounds(month);

  const prev = new Date(start);
  prev.setMonth(prev.getMonth() - 1);
  const prevStart = new Date(prev.getFullYear(), prev.getMonth(), 1);
  const prevEnd = start;

  const txns = await prisma.transaction.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    include: { category: true },
  });

  let totalSpend = 0;
  let totalMoneyIn = 0;
  let allMoneyOut = 0;
  let accountOutflow = 0;
  let creditCardSpend = 0;
  let uncategorizedCount = 0;
  const catAgg = new Map<number | null, { name: string; amount: number; isExpense: boolean }>();
  const incomeAgg = new Map<string, number>();
  const merchantAgg = new Map<string, number>();

  for (const t of txns) {
    const amt = Number(t.amount);
    if (t.direction === 'credit') {
      // Money in = what reached the bank account. A credit on a credit card is a
      // refund/reversal against the card, not income; a credit categorised as a
      // Transfer is your own money arriving from your own account, not income.
      const isTransferIn =
        (t.subcategoryId != null && selfTransferIds.has(t.subcategoryId)) ||
        (t.categoryId != null && selfTransferIds.has(t.categoryId));
      if (!t.isCreditCard && !isTransferIn) {
        totalMoneyIn += amt;
        // Income breakdown: by category when set, else by label (e.g. "Salary").
        const src = t.category?.name || t.displayLabel || 'Other income';
        incomeAgg.set(src, (incomeAgg.get(src) ?? 0) + amt);
      }
      continue;
    }
    // debit
    allMoneyOut += amt;
    // Only account debits reduce the balance; a card charge is owed, not paid.
    if (!t.isCreditCard) accountOutflow += amt;
    const effId = t.subcategoryId ?? t.categoryId;
    const isExpense = effId == null ? true : flags.get(effId) ?? true;
    if (t.categoryId == null) uncategorizedCount++;

    if (isExpense) {
      totalSpend += amt;
      if (t.isCreditCard) creditCardSpend += amt;
      const key = t.categoryId;
      const name = t.category?.name ?? 'Uncategorized';
      const cur = catAgg.get(key) ?? { name, amount: 0, isExpense };
      cur.amount += amt;
      catAgg.set(key, cur);
      const label = t.displayLabel || t.merchant;
      merchantAgg.set(label, (merchantAgg.get(label) ?? 0) + amt);
    }
  }

  const prevMonthSpend = await spendForRange(userId, prevStart, prevEnd, flags);
  const deltaPct = prevMonthSpend > 0 ? ((totalSpend - prevMonthSpend) / prevMonthSpend) * 100 : null;

  const categoryBreakdown: CategoryBreakdownItem[] = Array.from(catAgg.entries())
    .map(([categoryId, v]) => ({ categoryId, categoryName: v.name, amount: Math.round(v.amount * 100) / 100, isExpense: v.isExpense }))
    .sort((a, b) => b.amount - a.amount);

  const incomeBreakdown: CategoryBreakdownItem[] = Array.from(incomeAgg.entries())
    .map(([name, amount]) => ({ categoryId: null, categoryName: name, amount: Math.round(amount * 100) / 100, isExpense: false }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = Array.from(merchantAgg.entries())
    .map(([merchant, amount]) => ({ merchant, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    month,
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalMoneyIn: Math.round(totalMoneyIn * 100) / 100,
    allMoneyOut: Math.round(allMoneyOut * 100) / 100,
    accountOutflow: Math.round(accountOutflow * 100) / 100,
    creditCardSpend: Math.round(creditCardSpend * 100) / 100,
    prevMonthSpend: Math.round(prevMonthSpend * 100) / 100,
    deltaPct: deltaPct == null ? null : Math.round(deltaPct * 10) / 10,
    categoryBreakdown,
    incomeBreakdown,
    topMerchants,
    txnCount: txns.length,
    uncategorizedCount,
  };
}
