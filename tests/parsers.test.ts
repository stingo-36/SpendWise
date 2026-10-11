import { describe, it, expect } from 'vitest';
import { parseEmail } from '@/lib/parsers';
import { hdfcFixtures } from './fixtures/hdfc';
import { iciciFixtures } from './fixtures/icici';
import type { Fixture } from './fixtures/hdfc';

function runFixtures(name: string, fixtures: Fixture[]) {
  describe(name, () => {
    for (const f of fixtures) {
      it(f.name, () => {
        const result = parseEmail(f.email);
        expect(result.status).toBe(f.expect.status);
        if (f.expect.status === 'parsed' && result.status === 'parsed') {
          expect(result.txn.amount).toBe(f.expect.amount);
          expect(result.txn.direction).toBe(f.expect.direction);
          expect(result.txn.instrument).toBe(f.expect.instrument);
          expect(result.txn.rawMerchant.toLowerCase()).toContain(f.expect.rawMerchantIncludes.toLowerCase());
          if (f.expect.last4 !== undefined) expect(result.txn.accountLast4).toBe(f.expect.last4);
        }
      });
    }
  });
}

runFixtures('HDFC', hdfcFixtures);
runFixtures('ICICI', iciciFixtures);

/**
 * Card alerts HDFC sends that the original two orderings never matched. Both
 * shapes were sitting in parser-health as unparsed — real spend, missing from
 * the ledger — because (a) demands the word "spent" or "used" and neither
 * says it.
 */
describe('HDFC card alerts beyond "spent on"', () => {
  const email = (subject: string, bodyText: string) =>
    parseEmail({ sender: 'alerts@hdfcbank.bank.in', subject, bodyText, bodyHtml: null, receivedAt: new Date('2026-06-11T17:00:00Z') });

  it('debit card purchase — "is debited from your … Debit Card ending N at M"', () => {
    const r = email(
      'Rs.799.00 debited via Debit Card **6926',
      'Dear Customer, Greetings from HDFC Bank! Rs.799.00 is debited from your HDFC Bank Debit Card ending 6926 at ZEE ENTERTAINMENT on 11 Jun, 2026 at 22:37:53. If you did not authorize this transaction, please report it immediately or SMS "BLOCK DEBIT CARD 6926" to 7308080808.',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(799);
    expect(r.txn.direction).toBe('debit');
    expect(r.txn.instrument).toBe('card');
    // Not the 6926 from the "BLOCK DEBIT CARD" footer by luck — the real one.
    expect(r.txn.accountLast4).toBe('6926');
    expect(r.txn.rawMerchant).toBe('ZEE ENTERTAINMENT');
  });

  it('credit card alert — "Card ending in N .You made a transaction of Rs. X at M"', () => {
    const r = email(
      'We noticed a transaction on your Credit Card',
      'Dear Customer, Greetings from HDFC Bank. Thank you for using your HDFC Bank Credit Card ending in 7856 .You made a transaction of Rs. 720.00 at RAZ*Swiggy on 12-07-2026 17:58:49 . Authorization code: 056143',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(720);
    expect(r.txn.direction).toBe('debit');
    expect(r.txn.instrument).toBe('card');
    expect(r.txn.accountLast4).toBe('7856');
    expect(r.txn.rawMerchant).toBe('RAZ*Swiggy');
  });

  it('leaves a declined transaction alone — no money moved', () => {
    const r = email(
      'Declined Transaction: Usage Limit Exceeded on Your HDFC Bank Card',
      'Dear Customer, We regret to inform you that the transaction of Rs. 17664.00 on your HDFC Bank Credit Card ending in 7856 was declined as the usage limit was exceeded.',
    );
    expect(r.status).not.toBe('parsed');
  });
});
