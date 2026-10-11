import { describe, it, expect } from 'vitest';
import { parseSms } from '@/lib/parsers/sms';
import { normalizeSmsSender, parserForSmsSender } from '@/config/banks';

const RECEIVED = new Date('2026-09-11T09:30:00Z'); // 15:00 IST

function sms(sender: string, text: string) {
  return parseSms({ sender, subject: '', bodyText: text, bodyHtml: null, receivedAt: RECEIVED });
}

describe('DLT sender headers', () => {
  it('strips the operator prefix', () => {
    expect(normalizeSmsSender('VM-HDFCBK')).toBe('HDFCBK');
    expect(normalizeSmsSender('ad-icicib')).toBe('ICICIB');
    expect(normalizeSmsSender('AXISBK')).toBe('AXISBK');
  });

  it('routes known headers and rejects unknown ones', () => {
    expect(parserForSmsSender('JD-SBIINB')).toBe('sbi');
    expect(parserForSmsSender('VM-HDFCBK')).toBe('hdfc');
    expect(parserForSmsSender('TX-RANDOM')).toBeNull();
  });
});

describe('HDFC SMS', () => {
  it('parses a UPI debit', () => {
    const r = sms('VM-HDFCBK', 'Sent Rs.890.50 From HDFC Bank A/C *4821 To SWIGGY INSTAMART On 11-09-26 Ref 501234567890');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(890.5);
    expect(r.txn.direction).toBe('debit');
    expect(r.txn.rawMerchant).toBe('SWIGGY INSTAMART');
    expect(r.txn.accountLast4).toBe('4821');
    expect(r.txn.instrument).toBe('upi');
  });

  it('parses a card spend', () => {
    const r = sms('VM-HDFCBK', 'Spent Rs.499 On HDFC Bank CREDIT Card xx4821 At NETFLIX On 11-09-26');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(499);
    expect(r.txn.rawMerchant).toBe('NETFLIX');
    expect(r.txn.instrument).toBe('card');
  });
});

describe('SBI SMS', () => {
  it('parses the currency-less UPI debit', () => {
    const r = sms('JD-SBIINB', 'Dear UPI user A/C X4821 debited by 100.0 on date 11Sep26 trf to UBER INDIA Refno 501234567890');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(100);
    expect(r.txn.direction).toBe('debit');
    expect(r.txn.rawMerchant).toBe('UBER INDIA');
    expect(r.txn.instrument).toBe('upi');
  });

  it('parses a credit', () => {
    const r = sms('JD-SBIINB', 'Dear UPI user A/C X4821 credited by 2500.0 on date 11Sep26 by ACME CORP Refno 99887766');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.direction).toBe('credit');
    expect(r.txn.amount).toBe(2500);
  });
});

describe('ICICI SMS', () => {
  it('parses the "<payee> credited" shape', () => {
    const r = sms('AD-ICICIB', 'ICICI Bank Acct XX4821 debited for Rs 500.00 on 11-Sep-26; AMAZON PAY credited. UPI:501234567890.');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(500);
    expect(r.txn.rawMerchant).toBe('AMAZON PAY');
    expect(r.txn.direction).toBe('debit');
  });
});

describe('Axis SMS', () => {
  it('parses a card spend with no merchant keyword', () => {
    const r = sms('VK-AXISBK', 'Spent Card no. XX4821 INR 649 11-09-26 NETFLIX Avl Lmt INR 48000');
    expect(r.status).toBe('parsed');
    if (r.status !== 'parsed') return;
    expect(r.txn.amount).toBe(649);
    expect(r.txn.accountLast4).toBe('4821');
    expect(r.txn.rawMerchant).toBe('NETFLIX');
    expect(r.txn.instrument).toBe('card');
  });
});

describe('non-transaction SMS is ignored, not guessed at', () => {
  const cases: [string, string, string][] = [
    ['VM-HDFCBK', '123456 is your OTP for a transaction of Rs.500. Do not share it with anyone.', 'otp'],
    ['JD-SBIINB', 'Your A/C X4821 has Avl Bal Rs.15,234.00 as on 11-09-26', 'balance'],
    ['AD-ICICIB', 'Rs.999 will be debited from your account on 15-Sep-26 towards your SIP mandate', 'notice'],
  ];
  for (const [sender, text, reason] of cases) {
    it(`${reason}`, () => {
      const r = sms(sender, text);
      expect(r.status).toBe('ignored');
      if (r.status === 'ignored') expect(r.reason).toBe(reason);
    });
  }

  it('an unknown header never parses', () => {
    expect(sms('TX-PIZZAH', 'Spent Rs.500 at PIZZA PLACE').status).toBe('unparsed');
  });
});
