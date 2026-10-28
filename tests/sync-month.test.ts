import { describe, expect, it } from 'vitest';
import { monthQuery } from '@/lib/gmail';

describe('monthQuery', () => {
  it('bounds a month from its 1st to the next 1st', () => {
    expect(monthQuery('2026-10')).toBe('after:2026/10/01 before:2026/11/01');
  });

  it('rolls December into January of the next year', () => {
    expect(monthQuery('2026-12')).toBe('after:2026/12/01 before:2027/01/01');
  });
});
