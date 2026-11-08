/**
 * What's left in the account, carried from month to month.
 *
 * Each month opens with a balance and closes with
 *   closing = opening + money in − money out of the account.
 * The opening is, in order of preference:
 *   1. the amount you set for that month yourself (override), else
 *   2. the previous month's closing (carried forward), else
 *   3. 0, for the first month there's any data.
 * So setting one month's opening fixes every month after it too.
 *
 * The month math here is pure; the database part is at the bottom.
 */
import { prisma } from './db';
import { selfTransferCategoryIds } from './reporting';

export type OpeningSource = 'set' | 'carried' | 'start';

export interface MonthBalanceRow {
  month: string; // YYYY-MM
  opening: number;
  source: OpeningSource;
  moneyIn: number;
  moneyOut: number;
  closing: number;
}

export interface Flow {
  moneyIn: number;
  moneyOut: number;
}

const r = (n: number) => Math.round(n * 100) / 100;

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Every "YYYY-MM" from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
    if (out.length > 600) break; // 50 years — a guard, never a real range
  }
  return out;
}

/** Walk the months in order, carrying each closing into the next opening. */
export function runningBalances(months: string[], flows: Map<string, Flow>, overrides: Map<string, number>): MonthBalanceRow[] {
  const rows: MonthBalanceRow[] = [];
  let prevClosing: number | null = null;
  for (const month of months) {
    const set = overrides.get(month);
    const opening: number = set != null ? set : prevClosing ?? 0;
    const source: OpeningSource = set != null ? 'set' : prevClosing != null ? 'carried' : 'start';
    const f = flows.get(month) ?? { moneyIn: 0, moneyOut: 0 };
    const closing: number = opening + f.moneyIn - f.moneyOut;
    rows.push({ month, opening: r(opening), source, moneyIn: r(f.moneyIn), moneyOut: r(f.moneyOut), closing: r(closing) });
    prevClosing = closing;
  }
  return rows;
}

export interface MonthBalance {
  month: string;
  opening: number;
  source: OpeningSource;
  /** Previous month and its closing — what carrying forward would give. Null for the first month. */
  previous: { month: string; closing: number } | null;
  closing: number;
}

/**
 * The account balance for `month`. Money in and out follow the monthly
 * overview: card charges and card refunds never touch the account, and a
 * transfer in from your own account isn't money in.
 */
export async function getMonthBalance(userId: number, month: string): Promise<MonthBalance> {
  const [ty, tm] = month.split('-').map(Number);
  const end = new Date(ty, tm, 1); // first of the next month, local

  const [first, overridesRaw, selfIds] = await Promise.all([
    prisma.transaction.findFirst({ where: { userId, isCreditCard: false }, orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } }),
    prisma.monthBalance.findMany({ where: { userId, month: { lte: month } }, select: { month: true, opening: true } }),
    selfTransferCategoryIds(),
  ]);

  const candidates = [first ? monthKey(first.occurredAt) : null, ...overridesRaw.map((o) => o.month), month].filter(Boolean) as string[];
  const startMonth = candidates.sort()[0];
  const months = monthsBetween(startMonth, month);
  const [sy, sm] = startMonth.split('-').map(Number);

  const txns = await prisma.transaction.findMany({
    where: { userId, isCreditCard: false, occurredAt: { gte: new Date(sy, sm - 1, 1), lt: end } },
    select: { amount: true, direction: true, occurredAt: true, categoryId: true, subcategoryId: true },
  });

  const flows = new Map<string, Flow>();
  for (const t of txns) {
    const k = monthKey(t.occurredAt);
    const f = flows.get(k) ?? { moneyIn: 0, moneyOut: 0 };
    const amt = Number(t.amount);
    if (t.direction === 'credit') {
      const selfIn =
        (t.subcategoryId != null && selfIds.has(t.subcategoryId)) || (t.categoryId != null && selfIds.has(t.categoryId));
      if (!selfIn) f.moneyIn += amt;
    } else {
      f.moneyOut += amt;
    }
    flows.set(k, f);
  }

  const overrides = new Map(overridesRaw.map((o) => [o.month, Number(o.opening)]));
  const rows = runningBalances(months, flows, overrides);
  const cur = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  return {
    month,
    opening: cur.opening,
    source: cur.source,
    previous: prev ? { month: prev.month, closing: prev.closing } : null,
    closing: cur.closing,
  };
}
