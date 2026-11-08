import { describe, it, expect } from 'vitest';
import { checkSplit, splitEvenly, suggestShare, nameMatches, spendAmount, type OpenShare } from '@/lib/splits';

describe('checking a split', () => {
  it('accepts the rent example: 4,832 + 4,834 + 4,834 = 14,500', () => {
    const r = checkSplit(14500, 4832, [
      { name: 'Likitha', amount: 4834 },
      { name: ' Neetha ', amount: 4834 },
    ]);
    expect(r).toEqual({ ok: true, myShare: 4832, shares: [{ name: 'Likitha', amount: 4834 }, { name: 'Neetha', amount: 4834 }] });
  });

  it('says how much is left when the parts fall short', () => {
    const r = checkSplit(14500, 4800, [{ name: 'Likitha', amount: 4834 }, { name: 'Neetha', amount: 4834 }]);
    expect(r).toEqual({ ok: false, error: '₹32.00 is still unassigned.' });
  });

  it('says how much over the parts are', () => {
    const r = checkSplit(100, 60, [{ name: 'A', amount: 50 }]);
    expect(r).toEqual({ ok: false, error: 'The parts are ₹10.00 more than the total.' });
  });

  it('adds paise exactly (no float drift)', () => {
    expect(checkSplit(0.3, 0.1, [{ name: 'A', amount: 0.2 }]).ok).toBe(true);
  });

  it('lets your own share be zero when you paid only for others', () => {
    expect(checkSplit(500, 0, [{ name: 'A', amount: 500 }]).ok).toBe(true);
  });

  it('rejects blank names, zero shares and an empty split', () => {
    expect(checkSplit(100, 50, [{ name: '  ', amount: 50 }]).ok).toBe(false);
    expect(checkSplit(100, 100, [{ name: 'A', amount: 0 }]).ok).toBe(false);
    expect(checkSplit(100, 100, []).ok).toBe(false);
    expect(checkSplit(100, -1, [{ name: 'A', amount: 101 }]).ok).toBe(false);
  });

  it('keeps the id of an existing share so its settlement survives an edit', () => {
    const r = checkSplit(100, 50, [{ id: 7, name: 'A', amount: 50 }]);
    expect(r.ok && r.shares[0].id).toBe(7);
  });
});

describe('splitting equally', () => {
  it('gives the leftover paise to the first part', () => {
    expect(splitEvenly(14500, 3)).toEqual([4833.34, 4833.33, 4833.33]);
    expect(splitEvenly(100, 4)).toEqual([25, 25, 25, 25]);
  });
});

describe('what a debit costs you', () => {
  it('is your share when split, else the whole amount', () => {
    expect(spendAmount({ amount: '14500.00', myShare: '4832.00' })).toBe(4832);
    expect(spendAmount({ amount: '14500.00', myShare: null })).toBe(14500);
  });
});

describe('matching a pay-back to a share', () => {
  const rent = new Date('2026-11-03T04:00:00Z');
  const likitha: OpenShare = { id: 1, name: 'Likitha', amount: 4834, paidAt: rent };
  const neetha: OpenShare = { id: 2, name: 'Neetha', amount: 4834, paidAt: rent };

  it('matches UPI names loosely', () => {
    expect(nameMatches('Likitha', 'LIKITHA R')).toBe(true);
    expect(nameMatches('Neetha S', 'NEETHA SHARMA')).toBe(true);
    expect(nameMatches('Likitha', 'NEETHA')).toBe(false);
  });

  it('picks the share whose name matches when amounts tie', () => {
    const at = new Date('2026-11-07T12:00:00Z');
    expect(suggestShare({ amount: 4834, occurredAt: at, from: 'NEETHA SHARMA' }, [likitha, neetha])?.id).toBe(2);
    expect(suggestShare({ amount: 4834, occurredAt: at, from: 'LIKITHA R' }, [likitha, neetha])?.id).toBe(1);
  });

  it("doesn't guess between two same-amount shares when no name matches", () => {
    const at = new Date('2026-11-07T12:00:00Z');
    expect(suggestShare({ amount: 4834, occurredAt: at, from: 'UNKNOWN PERSON' }, [likitha, neetha])).toBeNull();
    expect(suggestShare({ amount: 4834, occurredAt: at, from: 'UNKNOWN PERSON' }, [likitha])?.id).toBe(1);
  });

  it('needs the exact amount, and a credit after the payment', () => {
    const at = new Date('2026-11-07T12:00:00Z');
    expect(suggestShare({ amount: 4800, occurredAt: at, from: 'LIKITHA' }, [likitha])).toBeNull();
    expect(suggestShare({ amount: 4834, occurredAt: new Date('2026-10-20T00:00:00Z'), from: 'LIKITHA' }, [likitha])).toBeNull();
    expect(suggestShare({ amount: 4834, occurredAt: new Date('2027-03-01T00:00:00Z'), from: 'LIKITHA' }, [likitha])).toBeNull();
  });
});
