import { EmailInput, ParseResult, Parser, atmWithdrawal, ignoredReason, last4, parseAmount, parseDateTime } from './types';

/**
 * Axis Bank alert templates.
 * Debit: "INR 320.00 debited from A/c no. XX7788 on 28-08-2026 at 13:05:22.
 *  Info: UPI/P2M/blinkit."
 * Card:  "Spent Card no. XX4471 INR 2,499.00 MYNTRA on 28-08-26."
 */
export const axisParser: Parser = (email: EmailInput): ParseResult => {
  const ignore = ignoredReason(email);
  if (ignore) return { status: 'ignored', reason: ignore };

  const body = email.bodyText || '';
  const when = parseDateTime(body, email.receivedAt);

  // ── ATM cash withdrawal ──────────────────────────────────────────────────
  // The generic debit template below does match "Info: ATM-WDL/...", but files
  // it as netbanking with the raw Info string as the merchant. Run this first
  // so a withdrawal is recorded as one.
  const cash = atmWithdrawal(body, when, null);
  if (cash) return { status: 'parsed', txn: cash };

  let m = body.match(/(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+debited from A\/c(?:\s*no\.?)?\s*(\w*\d{2,4}).*?Info:\s*(.+?)[.\n]/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      const instrument = /UPI/i.test(m[3]) ? 'upi' : 'netbanking';
      return { status: 'parsed', txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[2]), instrument, referenceId: null } };
    }
  }

  m = body.match(/(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+credited to A\/c(?:\s*no\.?)?\s*(\w*\d{2,4}).*?Info:\s*(.+?)[.\n]/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return { status: 'parsed', txn: { amount, direction: 'credit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[2]), instrument: 'netbanking', referenceId: null } };
    }
  }

  m = body.match(/Spent\s+Card no\.?\s*(\w*\d{4})\s*(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+(.+?)\s+on\s+/i);
  if (m) {
    const amount = parseAmount(m[2]);
    if (amount != null) {
      return { status: 'parsed', txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[1]), instrument: 'card', referenceId: null } };
    }
  }

  return { status: 'unparsed' };
};
