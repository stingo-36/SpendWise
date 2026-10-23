/**
 * The spending summary the Kaizen mobile app shows (its home card and Spending
 * screen). Built from the same reporting functions as the web overview, so the
 * phone and the dashboard always agree on the month's totals.
 */
import { prisma } from './db';
import { getBudgetProgress, getMonthlyOverview, getWeeklyCategorySpend } from './reporting';

export interface MobileSummary {
  month: string; // YYYY-MM
  totalSpend: number;
  prevMonthSpend: number;
  deltaPct: number | null;
  /** Sum of the user's monthly budgets; null when none are set. */
  budget: number | null;
  /** Spend in the budgeted categories only — what `budget` is measured against. */
  budgetSpent: number;
  /** Spend today (IST). Only meaningful when `month` is the current month. */
  todaySpend: number;
  categories: { name: string; amount: number; budget: number | null }[];
  weeks: { label: string; total: number }[];
  recent: { id: number; merchant: string; amount: number; occurredAt: string; category: string | null; instrument: string; isCreditCard: boolean }[];
  uncategorizedCount: number;
  /** Spend charged to registered credit cards this month (part of totalSpend). */
  creditCardSpend: number;
  /** Credits landing in the bank account, and debits that actually left it. */
  moneyIn: number;
  accountOutflow: number;
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const round = (n: number) => Math.round(n * 100) / 100;

/** [start, end) of today's IST calendar day, as absolute instants. */
function istToday(now = new Date()): { start: Date; end: Date } {
  const day = Math.floor((now.getTime() + IST_OFFSET_MS) / 86_400_000);
  const start = new Date(day * 86_400_000 - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export async function getMobileSummary(userId: number, month: string): Promise<MobileSummary> {
  const today = istToday();
  const [overview, weekly, budgets, cats, recentTxns] = await Promise.all([
    getMonthlyOverview(userId, month),
    getWeeklyCategorySpend(userId, month),
    getBudgetProgress(userId, month),
    prisma.category.findMany({ select: { id: true, isExpense: true } }),
    prisma.transaction.findMany({
      where: { userId, direction: 'debit' },
      orderBy: { occurredAt: 'desc' },
      take: 30,
      select: {
        id: true, amount: true, occurredAt: true, merchant: true, displayLabel: true, instrument: true,
        isCreditCard: true, categoryId: true, subcategoryId: true, category: { select: { name: true } },
      },
    }),
  ]);
  const flags = new Map(cats.map((c) => [c.id, c.isExpense]));
  const isExpense = (t: { categoryId: number | null; subcategoryId: number | null }) => {
    const effId = t.subcategoryId ?? t.categoryId;
    return effId == null ? true : flags.get(effId) ?? true;
  };

  // Today's spend, counted the same way as the month total (is_expense debits).
  const todayTxns = await prisma.transaction.findMany({
    where: { userId, direction: 'debit', occurredAt: { gte: today.start, lt: today.end } },
    select: { amount: true, categoryId: true, subcategoryId: true },
  });
  const todaySpend = todayTxns.filter(isExpense).reduce((s, t) => s + Number(t.amount), 0);

  const budgetByName = new Map(budgets.map((b) => [b.categoryName, b.budget]));
  const budgetTotal = budgets.reduce((s, b) => s + b.budget, 0);

  return {
    month,
    totalSpend: overview.totalSpend,
    prevMonthSpend: overview.prevMonthSpend,
    deltaPct: overview.deltaPct,
    budget: budgets.length ? round(budgetTotal) : null,
    budgetSpent: round(budgets.reduce((sum, b) => sum + b.spent, 0)),
    todaySpend: round(todaySpend),
    categories: overview.categoryBreakdown.map((c) => ({
      name: c.categoryName,
      amount: c.amount,
      budget: budgetByName.get(c.categoryName) ?? null,
    })),
    weeks: weekly.weeks.map((w) => ({ label: w.label, total: w.total })),
    // Transfers and card-bill payments are not spend, so they stay off the list.
    recent: recentTxns.filter(isExpense).slice(0, 10).map((t) => ({
      id: t.id,
      merchant: t.displayLabel || t.merchant,
      amount: round(Number(t.amount)),
      occurredAt: t.occurredAt.toISOString(),
      category: t.category?.name ?? null,
      instrument: t.instrument,
      isCreditCard: t.isCreditCard,
    })),
    uncategorizedCount: overview.uncategorizedCount,
    creditCardSpend: overview.creditCardSpend,
    moneyIn: overview.totalMoneyIn,
    accountOutflow: overview.accountOutflow,
  };
}
