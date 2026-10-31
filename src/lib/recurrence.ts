/**
 * Where a recurring payment lands within a given month, projected from its
 * next expected date. Pure (no DB) so it's easy to test.
 *
 * Monthly, quarterly and annual payments keep their day of the month (clamped
 * to the month's length, so a 31st charge falls on the 30th in November);
 * stepping by a fixed day count would drift — 30-day steps walk a 5th charge
 * back to the 1st within half a year. Weekly ones step by seven days.
 */

const MONTH_STEP: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

/** Days in a month (month 1–12). */
function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * @param next  next expected date, YYYY-MM-DD
 * @param month the month to fill, YYYY-MM
 * @returns     YYYY-MM-DD dates inside `month`, ascending
 */
export function occurrencesInMonth(next: string, cadence: string, intervalDays: number, month: string): string[] {
  const [ny, nm, nd] = next.split('-').map(Number);
  const [y, m] = month.split('-').map(Number);

  const step = MONTH_STEP[cadence];
  if (step) {
    const diff = (y - ny) * 12 + (m - nm);
    if (((diff % step) + step) % step !== 0) return [];
    return [`${month}-${pad(Math.min(nd, daysIn(y, m)))}`];
  }

  // Fixed-interval (weekly or anything irregular).
  const every = Math.max(1, Math.round(intervalDays || 7));
  const dayMs = 86_400_000;
  const first = Date.UTC(y, m - 1, 1);
  const last = Date.UTC(y, m - 1, daysIn(y, m));
  let t = Date.UTC(ny, nm - 1, nd);
  // Walk back to the first occurrence on or after the month's first day.
  if (t > first) t -= Math.ceil((t - first) / (every * dayMs)) * every * dayMs;
  while (t < first) t += every * dayMs;
  const out: string[] = [];
  for (; t <= last; t += every * dayMs) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
