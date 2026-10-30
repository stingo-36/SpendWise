/**
 * Credit card billing cycles. The bill is generated on the user's statement
 * day D each month and covers charges from D+1 of the previous month through
 * D itself — e.g. D = 15 → 16 Sep … 15 Oct, billed on 15 Oct.
 *
 * Pure (no DB), so client pages and reporting share one definition. Dates are
 * built in local time, the same way reporting's monthBounds does.
 */

export const DEFAULT_STATEMENT_DAY = 15;
/** 1–28 so every month has the day; a 30th/31st would drift in February. */
export const MAX_STATEMENT_DAY = 28;

export interface BillingCycle {
  /** First day of the cycle, local midnight. */
  start: Date;
  /** Exclusive end: local midnight after the statement day. */
  end: Date;
  /** The day the bill is generated (last day of the cycle). */
  statementDate: Date;
  /** Inclusive YYYY-MM-DD bounds for the transactions API's from/to. */
  from: string;
  to: string;
  /** "16 Oct – 15 Nov" */
  label: string;
}

export function clampStatementDay(day: unknown): number {
  const n = Math.round(Number(day));
  if (!Number.isFinite(n)) return DEFAULT_STATEMENT_DAY;
  return Math.min(MAX_STATEMENT_DAY, Math.max(1, n));
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const short = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** The cycle whose bill is generated on `day` of the given month (0-based). */
export function cycleEndingIn(year: number, month: number, day: number): BillingCycle {
  const statementDate = new Date(year, month, day);
  const start = new Date(year, month - 1, day + 1);
  const end = new Date(year, month, day + 1);
  return { start, end, statementDate, from: ymd(start), to: ymd(statementDate), label: `${short(start)} – ${short(statementDate)}` };
}

/** The cycle a given moment falls in. */
export function cycleContaining(at: Date, day: number): BillingCycle {
  const d = clampStatementDay(day);
  // Past the statement day → this month's bill is out; the charge is on next month's.
  const nextMonth = at.getDate() > d;
  return cycleEndingIn(at.getFullYear(), at.getMonth() + (nextMonth ? 1 : 0), d);
}

/** The current (open) cycle first, then the `count - 1` before it. */
export function recentCycles(day: number, count: number, now = new Date()): BillingCycle[] {
  const cur = cycleContaining(now, day);
  const y = cur.statementDate.getFullYear();
  const m = cur.statementDate.getMonth();
  return Array.from({ length: count }, (_, i) => cycleEndingIn(y, m - i, clampStatementDay(day)));
}
