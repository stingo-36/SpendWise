import { describe, it, expect } from 'vitest';
import { occurrencesInMonth } from '@/lib/recurrence';

describe('recurring payments on the money calendar', () => {
  it('keeps a monthly charge on its day of the month', () => {
    expect(occurrencesInMonth('2026-11-07', 'monthly', 30, '2027-03')).toEqual(['2027-03-07']);
    expect(occurrencesInMonth('2026-11-07', 'monthly', 30, '2026-09')).toEqual(['2026-09-07']);
  });

  it('clamps a 31st to short months', () => {
    expect(occurrencesInMonth('2026-10-31', 'monthly', 30, '2026-11')).toEqual(['2026-11-30']);
    expect(occurrencesInMonth('2026-10-31', 'monthly', 30, '2027-02')).toEqual(['2027-02-28']);
  });

  it('only lands quarterly and annual charges in their months', () => {
    expect(occurrencesInMonth('2026-11-10', 'quarterly', 91, '2027-02')).toEqual(['2027-02-10']);
    expect(occurrencesInMonth('2026-11-10', 'quarterly', 91, '2027-01')).toEqual([]);
    expect(occurrencesInMonth('2027-03-14', 'annual', 365, '2026-03')).toEqual(['2026-03-14']);
    expect(occurrencesInMonth('2027-03-14', 'annual', 365, '2026-11')).toEqual([]);
  });

  it('steps weekly charges through the month, forwards and backwards', () => {
    expect(occurrencesInMonth('2026-11-03', 'weekly', 7, '2026-11')).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
    expect(occurrencesInMonth('2026-12-29', 'weekly', 7, '2026-11')).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  });
});
