/**
 * One month of money on a calendar: what comes in, what's due to go out, and
 * the card's bill date. Recurring payments are projected from their next
 * expected date (lib/recurrence.ts); income is what actually arrived, plus the
 * salary auto-credit when it's switched on and hasn't landed yet.
 */
import { prisma } from './db';
import { occurrencesInMonth } from './recurrence';
import { getStatementDay } from './creditCards';
import { selfTransferCategoryIds } from './reporting';

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  kind: 'in' | 'out' | 'bill' | 'cycle';
  label: string;
  amount: number | null;
  /** Expected rather than already happened. */
  projected: boolean;
}

export interface MonthCalendar {
  month: string;
  events: CalendarEvent[];
  expectedIn: number;
  fixedOut: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export async function getMonthCalendar(userId: number, month: string): Promise<MonthCalendar> {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const lastDay = new Date(y, m, 0).getDate();

  const [subs, statementDay, user, credits, selfTransferIds] = await Promise.all([
    prisma.subscription.findMany({ where: { userId, status: { in: ['active', 'price_changed'] } } }),
    getStatementDay(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { salaryEnabled: true, salaryAmount: true, salaryDay: true } }),
    prisma.transaction.findMany({
      where: { userId, direction: 'credit', isCreditCard: false, occurredAt: { gte: start, lt: end }, category: { isExpense: false } },
      select: { amount: true, occurredAt: true, merchant: true, displayLabel: true, categoryId: true, subcategoryId: true, category: { select: { name: true } } },
    }),
    selfTransferCategoryIds(),
  ]);

  const events: CalendarEvent[] = [];

  for (const s of subs) {
    for (const date of occurrencesInMonth(s.nextExpected.toISOString().slice(0, 10), s.cadence, s.intervalDays, month)) {
      events.push({ date, kind: 'out', label: s.merchant, amount: Number(s.medianAmount), projected: true });
    }
  }

  // Income that arrived: categorised as income, not a transfer between your own accounts.
  for (const c of credits) {
    if (c.category?.name === 'Transfers') continue;
    if ((c.subcategoryId != null && selfTransferIds.has(c.subcategoryId)) || (c.categoryId != null && selfTransferIds.has(c.categoryId))) continue;
    const d = c.occurredAt;
    events.push({
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      kind: 'in',
      label: c.displayLabel || c.merchant,
      amount: Number(c.amount),
      projected: false,
    });
  }

  // Salary auto-credit, unless a credit of at least half of it already came in.
  if (user?.salaryEnabled && user.salaryAmount) {
    const salary = Number(user.salaryAmount);
    const arrived = events.some((e) => e.kind === 'in' && (e.amount ?? 0) >= salary / 2);
    if (!arrived) {
      events.push({ date: `${month}-${pad(Math.min(user.salaryDay, lastDay))}`, kind: 'in', label: 'Salary', amount: salary, projected: true });
    }
  }

  events.push({ date: `${month}-${pad(statementDay)}`, kind: 'bill', label: 'Card bill generated', amount: null, projected: true });
  if (statementDay < lastDay) {
    events.push({ date: `${month}-${pad(statementDay + 1)}`, kind: 'cycle', label: 'New card cycle', amount: null, projected: true });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  const sum = (k: CalendarEvent['kind']) => Math.round(events.filter((e) => e.kind === k).reduce((s, e) => s + (e.amount ?? 0), 0) * 100) / 100;
  return { month, events, expectedIn: sum('in'), fixedOut: sum('out') };
}
