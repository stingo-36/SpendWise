import { describe, expect, it } from 'vitest';
import { isMatchingAutoDebitAlert } from '@/lib/dedupe';

function txn(instrument: string, occurredAt: string, rawMerchant: string, displayLabel: string | null = null) {
  return {
    instrument,
    occurredAt: new Date(occurredAt),
    rawMerchant,
    merchant: rawMerchant.toUpperCase(),
    displayLabel,
  };
}

describe('auto-debit sibling alerts', () => {
  it('matches the InCred mandate and later netbanking confirmation', () => {
    const mandate = txn('auto_debit', '2026-10-05T07:31:23.000Z', 'ACH D- INCRED FINANCIAL SER-EghcExzFEMgl', 'InCred EMI');
    const confirmation = txn('netbanking', '2026-10-05T11:07:02.000Z', 'INCRED FINANCIAL SERVICES LTD/5925610913716017A with UMRN HDFC7020712242020567', 'InCred EMI');
    expect(isMatchingAutoDebitAlert(mandate, confirmation)).toBe(true);
  });

  it('does not merge two ordinary netbanking payments', () => {
    const a = txn('netbanking', '2026-10-05T07:31:23.000Z', 'INCRED PAYMENT');
    const b = txn('netbanking', '2026-10-05T11:07:02.000Z', 'INCRED PAYMENT');
    expect(isMatchingAutoDebitAlert(a, b)).toBe(false);
  });

  it('does not merge different merchants merely because both are finance companies', () => {
    const a = txn('auto_debit', '2026-10-05T07:31:23.000Z', 'ACH D- INCRED FINANCIAL SERVICES');
    const b = txn('netbanking', '2026-10-05T08:00:00.000Z', 'ACME FINANCIAL SERVICES LTD');
    expect(isMatchingAutoDebitAlert(a, b)).toBe(false);
  });

  it('does not merge matching mandates on different IST dates', () => {
    const a = txn('auto_debit', '2026-10-05T18:20:00.000Z', 'INCRED MANDATE');
    const b = txn('netbanking', '2026-10-05T19:00:00.000Z', 'INCRED PAYMENT');
    expect(isMatchingAutoDebitAlert(a, b)).toBe(false);
  });
});
