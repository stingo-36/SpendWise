/**
 * Cash withdrawals.
 *
 * Every bank's email module had templates for UPI, card and netbanking but
 * none for an ATM withdrawal, so the alert matched nothing and the money never
 * became a transaction. These pin the shape of each bank's withdrawal alert on
 * both rails.
 */
import { describe, it, expect } from 'vitest';
import { parseEmail } from '@/lib/parsers';
import { parseSms } from '@/lib/parsers/sms';

const RECEIVED = new Date('2026-09-12T13:00:00Z'); // 18:30 IST

function email(sender: string, subject: string, bodyText: string) {
  return parseEmail({ sender, subject, bodyText, bodyHtml: null, receivedAt: RECEIVED });
}
function sms(sender: string, bodyText: string) {
  return parseSms({ sender, subject: '', bodyText, bodyHtml: null, receivedAt: RECEIVED });
}

describe('ATM withdrawal emails', () => {
  it('HDFC: withdrawn from A/c at a named ATM', () => {
    const r = email(
      'alerts@hdfcbank.net',
      'Cash Withdrawal Alert',
      'Dear Customer, Rs.5000.00 has been withdrawn from your A/c XX5427 at HDFC BANK ATM KORAMANGALA on 12-09-26 at 18:22:04. Avl Bal Rs.12,300.00.',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(5000);
    expect(r.txn.direction).toBe('debit');
    expect(r.txn.instrument).toBe('atm');
    expect(r.txn.accountLast4).toBe('5427');
    // The account token must not be glued onto the ATM's location.
    expect(r.txn.rawMerchant).toBe('HDFC BANK ATM KORAMANGALA');
  });

  it('HDFC: card-based withdrawal, no account number in the alert', () => {
    const r = email(
      'alerts@hdfcbank.net',
      'ATM Withdrawal',
      'Thank you for using HDFC Bank Card ending 4471 for a cash withdrawal of Rs.2,000.00 at ATM on 12-09-26.',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(2000);
    expect(r.txn.instrument).toBe('atm');
  });

  it('ICICI: debited with Info: ATM-CASH WDL', () => {
    const r = email(
      'alerts@icicibank.com',
      'Transaction alert',
      'Dear Customer, Your ICICI Bank Account XX123 has been debited with Rs 3,000.00 on 12-Sep-26. Info: ATM-CASH WDL-BANGALORE. Available balance is Rs 9,000.00.',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(3000);
    expect(r.txn.instrument).toBe('atm');
    expect(r.txn.rawMerchant).toContain('BANGALORE');
  });

  it('SBI: withdrawn at an ATM id, account after "from"', () => {
    const r = email(
      'alerts@sbi.co.in',
      'ATM withdrawal',
      'Rs.2000 withdrawn at SBI ATM S1NW000012345 from A/c X4567 on 12-09-26. Avl Bal Rs.5,000.00.',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(2000);
    expect(r.txn.instrument).toBe('atm');
    expect(r.txn.accountLast4).toBe('4567');
    expect(r.txn.rawMerchant).not.toContain('A/c');
  });

  it('Axis: files as atm, not netbanking, and never as the clock time', () => {
    const r = email(
      'alerts@axisbank.com',
      'Debit alert',
      'INR 3000.00 debited from A/c no. XX7788 on 12-09-2026 at 19:10:00. Info: ATM-WDL/ATM ID 4455. Avl Bal INR 8000.',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(3000);
    expect(r.txn.instrument).toBe('atm');
    expect(r.txn.rawMerchant).not.toMatch(/^[\d:]+$/);
  });

  it('leaves an ordinary card purchase alone', () => {
    const r = email(
      'alerts@hdfcbank.net',
      'Card transaction',
      'Rs.499.00 has been spent on Card ending 4471 at NETFLIX on 12-09-26.',
    );
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.instrument).toBe('card');
    expect(r.txn.rawMerchant).toBe('NETFLIX');
  });
});

describe('ATM withdrawal SMS', () => {
  it('HDFC: keeps the location, drops the account token', () => {
    const r = sms('VM-HDFCBK', 'Rs.5000.00 withdrawn at HDFC BANK ATM KORAMANGALA from A/c XX5427 on 12-09-26. Avl Bal Rs.12300.');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.instrument).toBe('atm');
    expect(r.txn.rawMerchant).toBe('HDFC BANK ATM KORAMANGALA');
  });

  it('ICICI: names an unlabelled withdrawal instead of "Unknown"', () => {
    const r = sms('AD-ICICIB', 'ICICI Bank Acct XX123 debited Rs 3000.00 on 12-Sep-26; ATM-CASH WDL. Avl Bal Rs 9000.');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.instrument).toBe('atm');
    expect(r.txn.rawMerchant).toBe('ATM Withdrawal');
  });
});

/**
 * Wordings HDFC actually sends. The noun forms ("Cash Withdrawal", "ATM WDL")
 * matched no debit verb at all, so those alerts came back unparsed.
 */
describe('real HDFC withdrawal SMS wordings', () => {
  const cases: [string, string, number, string][] = [
    ['card-based, ATM named',
     'Rs.5000.00 withdrawn from HDFC Bank Card ending 6926 at HDFC BANK ATM on 2026-09-10:19:22:33. Avl Bal: Rs.12300.00',
     5000, 'HDFC BANK ATM'],
    ['account-based, bare "at ATM"',
     'Dear Customer, Rs.10000.00 has been withdrawn from your A/c XX5427 at ATM on 10-09-26. Avl Bal Rs.66,800.13',
     10000, 'ATM'],
    ['noun form, no verb anywhere',
     'Amt Sent Rs.3000.00 From HDFC Bank A/C x5427 Cash Withdrawal On 10-09-26 Ref 4455',
     3000, 'ATM Withdrawal'],
    ['ATM WDL shorthand',
     'Rs 2000 debited from a/c **5427 on 10-09-26 ATM WDL KORAMANGALA. Avl bal Rs 5000',
     2000, 'ATM Withdrawal'],
  ];

  for (const [name, text, amount, merchant] of cases) {
    it(name, () => {
      const r = sms('VM-HDFCBK', text);
      expect(r.status).toBe('parsed');
      if (r.status !== 'parsed') return;
      expect(r.txn.amount).toBe(amount);
      expect(r.txn.direction).toBe('debit');
      expect(r.txn.instrument).toBe('atm');
      // Never the account it came out of — that would name each withdrawal
      // from one account differently.
      expect(r.txn.rawMerchant).toBe(merchant);
    });
  }

  it('still ignores a pure balance alert', () => {
    const r = sms('VM-HDFCBK', 'Avl Bal in A/c XX5427 is Rs.12,300.00 as on 10-09-26.');
    expect(r.status).toBe('ignored');
  });
});
