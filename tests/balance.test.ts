import { describe, it, expect } from 'vitest';
import { monthsBetween, runningBalances } from '@/lib/balance';

describe('months between', () => {
  it('crosses a year end', () => {
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween('2026-11', '2026-11')).toEqual(['2026-11']);
  });
});

describe('carrying the balance forward', () => {
  const flows = new Map([
    ['2026-09', { moneyIn: 80000, moneyOut: 70000 }],
    ['2026-10', { moneyIn: 72917, moneyOut: 60000 }],
    ['2026-11', { moneyIn: 72917, moneyOut: 58237.03 }],
  ]);
  const months = ['2026-09', '2026-10', '2026-11'];

  it('starts at 0 and carries each closing into the next opening', () => {
    const rows = runningBalances(months, flows, new Map());
    expect(rows.map((r) => [r.source, r.opening, r.closing])).toEqual([
      ['start', 0, 10000],
      ['carried', 10000, 22917],
      ['carried', 22917, 37596.97],
    ]);
  });

  it('uses an amount you set, and carries from it onwards', () => {
    const rows = runningBalances(months, flows, new Map([['2026-10', 5000]]));
    expect(rows[1]).toMatchObject({ source: 'set', opening: 5000, closing: 17917 });
    expect(rows[2]).toMatchObject({ source: 'carried', opening: 17917, closing: 32596.97 });
  });

  it('lets you start a month from zero', () => {
    const rows = runningBalances(months, flows, new Map([['2026-11', 0]]));
    expect(rows[2]).toMatchObject({ source: 'set', opening: 0, closing: 14679.97 });
  });

  it('carries through a month with no transactions', () => {
    const rows = runningBalances(['2026-09', '2026-10'], new Map([['2026-09', { moneyIn: 100, moneyOut: 40 }]]), new Map());
    expect(rows[1]).toMatchObject({ source: 'carried', opening: 60, closing: 60 });
  });
});
