import { describe, it, expect } from 'vitest';
import { normalizeMerchant, looksLikeVpa } from '@/lib/merchant';

describe('merchant normalization (§6)', () => {
  it('strips rail prefix, order ref, and country token', () => {
    expect(normalizeMerchant('UPI/P2M/SWIGGY*ORDER12345/HDFC')).toContain('SWIGGY');
    expect(normalizeMerchant('UPI/P2M/SWIGGY*ORDER12345/HDFC')).not.toContain('12345');
  });

  it('strips POS, masked card, city and country', () => {
    const out = normalizeMerchant('POS 4471XXXX BLINKIT BANGALORE IN');
    expect(out).toContain('BLINKIT');
    expect(out).not.toContain('BANGALORE');
    expect(out).not.toMatch(/\bIN\b/);
  });

  it('keeps a bare person VPA as the merchant key', () => {
    expect(looksLikeVpa('john.doe@okhdfc')).toBe(true);
    expect(normalizeMerchant('john.doe@okhdfc')).toBe('JOHN.DOE@OKHDFC');
  });

  it('does not treat a merchant-with-VPA as a person transfer', () => {
    expect(looksLikeVpa('SWIGGY*ORDER/swiggy@ybl')).toBe(false);
  });

  it('surfaces the sender from a hyphenated transfer narration', () => {
    // Account-statement credit: the only useful part is the person's name.
    const out = normalizeMerchant('XXXXXXXXXX6069-TPT-SALARY SAHIL SAJJAN-SK');
    expect(out).toContain('SAHIL SAJJAN');
    expect(out).not.toContain('TPT');
    expect(out).not.toContain('6069');
    expect(out).not.toMatch(/\bSK\b/);
  });

  it('keeps a trailing initial that is part of the name', () => {
    // Space-separated initials are name parts, not bank codes.
    expect(normalizeMerchant('NEETHA H M')).toBe('NEETHA H M');
    expect(normalizeMerchant('SUNIL V')).toBe('SUNIL V');
  });

  it('drops a hyphen-attached rail code even when spaced out', () => {
    // Real HDFC narration: "FT- <name>-<masked acct> - UP".
    expect(normalizeMerchant('FT- Sahil Sajjan Tari-XXXXXXXXXX9849 - UP')).toBe('SAHIL SAJJAN TARI');
  });

  it('keeps the payer name out of an IMPS narration', () => {
    const out = normalizeMerchant('IMPS-503412345678-PRIYA SHARMA-HDFC');
    expect(out).toContain('PRIYA SHARMA');
    expect(out).not.toContain('503412345678');
  });
});

/**
 * Aggregator descriptors invert the usual star convention: the aggregator is
 * the prefix and the merchant is the suffix, so stripping after the star (as
 * SWIGGY*ORDER12345 needs) filed every Razorpay charge under "RAZ".
 */
describe('payment-aggregator prefixes', () => {
  it('keeps the merchant, drops the aggregator', () => {
    expect(normalizeMerchant('RAZ*Swiggy')).toBe('SWIGGY');
    expect(normalizeMerchant('PAYU*Myntra')).toBe('MYNTRA');
    expect(normalizeMerchant('CCAV*BookMyShow')).toBe('BOOKMYSHOW');
    expect(normalizeMerchant('RAZORPAY*Zomato')).toBe('ZOMATO');
  });

  it('still strips an order ref after a real merchant', () => {
    expect(normalizeMerchant('SWIGGY*ORDER12345')).toBe('SWIGGY');
  });
});
