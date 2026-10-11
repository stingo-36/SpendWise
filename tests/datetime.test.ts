import { describe, it, expect } from 'vitest';
import { parseDateTime } from '@/lib/parsers/types';

// Bank body times are IST; occurred_at must be a correct absolute instant
// regardless of server timezone (Vercel runs in UTC). See parsers/types.ts.
describe('parseDateTime IST handling (§5.3 dedup robustness)', () => {
  const fallback = new Date('2026-08-28T07:00:00Z'); // = 12:30 IST

  it('interprets an explicit body time as IST', () => {
    const d = parseDateTime('txn on 28-08-2026 14:32:10', fallback);
    // 14:32:10 IST = 09:02:10 UTC
    expect(d.toISOString()).toBe('2026-08-28T09:02:10.000Z');
  });

  it('borrows the received IST time-of-day when the body has no time', () => {
    const d = parseDateTime('debited on 28-08-26 to VPA swiggy@ybl', fallback);
    // date 28-08 + received time-of-day 12:30 IST = 07:00 UTC
    expect(d.toISOString()).toBe('2026-08-28T07:00:00.000Z');
  });

  it('handles dd-Mon-yy with no time', () => {
    const d = parseDateTime('on 28-Aug-26 and credited', fallback);
    expect(d.toISOString()).toBe('2026-08-28T07:00:00.000Z');
  });

  it('falls back entirely when no date is present', () => {
    const d = parseDateTime('no date here at all', fallback);
    expect(d.getTime()).toBe(fallback.getTime());
  });
});
