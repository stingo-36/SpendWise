import { describe, it, expect } from 'vitest';
import { clampStatementDay, cycleContaining, recentCycles } from '@/lib/billingCycle';

describe('credit card billing cycle (statement on the 15th)', () => {
  it('a charge after the statement day lands on next month’s bill', () => {
    const c = cycleContaining(new Date(2026, 9, 31, 12), 15); // 31 Oct
    expect([c.from, c.to]).toEqual(['2026-10-16', '2026-11-15']);
  });

  it('a charge on the statement day is on that day’s bill', () => {
    const c = cycleContaining(new Date(2026, 9, 15, 23, 59), 15);
    expect([c.from, c.to]).toEqual(['2026-09-16', '2026-10-15']);
    expect(c.end.getTime()).toBe(new Date(2026, 9, 16).getTime());
  });

  it('wraps across the year', () => {
    const c = cycleContaining(new Date(2027, 0, 3), 15);
    expect([c.from, c.to]).toEqual(['2026-12-16', '2027-01-15']);
  });

  it('lists the open cycle first, then earlier ones', () => {
    const cs = recentCycles(15, 3, new Date(2026, 9, 31));
    expect(cs.map((c) => c.to)).toEqual(['2026-11-15', '2026-10-15', '2026-09-15']);
  });

  it('keeps the day inside every month', () => {
    expect(clampStatementDay(31)).toBe(28);
    expect(clampStatementDay(0)).toBe(1);
    expect(clampStatementDay('x')).toBe(15);
  });
});
