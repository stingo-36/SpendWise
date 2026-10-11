import type { Fixture } from './hdfc';

const base = { sender: 'alerts@icicibank.com', bodyHtml: null, receivedAt: new Date('2026-08-28T09:00:00Z') };

export const iciciFixtures: Fixture[] = [
  {
    name: 'UPI debit',
    email: {
      ...base,
      subject: 'Transaction alert',
      bodyText:
        'Dear Customer, ICICI Bank Acct XX4567 is debited with Rs 250.00 on 28-Aug-26 and credited to zepto.payu@icici (UPI Ref no 422098765432).',
    },
    expect: { status: 'parsed', amount: 250, direction: 'debit', rawMerchantIncludes: 'zepto', instrument: 'upi', last4: '4567' },
  },
  {
    name: 'Card transaction',
    email: {
      ...base,
      subject: 'Transaction on ICICI Bank Card',
      bodyText: 'Transaction of INR 1,999.00 on ICICI Bank Card XX4471 on 28-08-2026 at AMAZON. Available limit is INR 50,000.',
    },
    expect: { status: 'parsed', amount: 1999, direction: 'debit', rawMerchantIncludes: 'AMAZON', instrument: 'card', last4: '4471' },
  },
];
