import { EmailInput, ParseResult, Parser, atmWithdrawal, ignoredReason, last4, parseAmount, parseDateTime } from './types';

/**
 * ICICI Bank alert templates.
 *
 * UPI debit example:
 *   "ICICI Bank Acct XX123 is debited with Rs 250.00 on 28-Aug-26 and credited
 *    to zepto.payu@icici (UPI Ref no 422098765432)."
 * Card example:
 *   "Transaction of INR 1,999.00 on ICICI Bank Card XX4471 on 28-08-2026 at
 *    AMAZON."
 */
export const iciciParser: Parser = (email: EmailInput): ParseResult => {
  const ignore = ignoredReason(email);
  if (ignore) return { status: 'ignored', reason: ignore };

  const body = email.bodyText || '';
  const when = parseDateTime(body, email.receivedAt);

  // ── ATM cash withdrawal ──────────────────────────────────────────────────
  // "Info: ATM-CASH WDL-<place>" names no payee, so the UPI template below
  // (which needs a "credited to <vpa>") can never match it.
  const cash = atmWithdrawal(body, when, body.match(/UPI Ref (?:no)?\.?\s*(\w+)/i)?.[1] ?? null);
  if (cash) return { status: 'parsed', txn: cash };

  // ── UPI debit ────────────────────────────────────────────────────────────
  let m = body.match(/Acct\s*(\w*\d{2,4}).*?debited with\s*(?:Rs|INR)\.?\s*([\d,]+\.?\d*).*?credited to\s*([^\s(]+)/i);
  if (m) {
    const amount = parseAmount(m[2]);
    if (amount != null) {
      const ref = body.match(/UPI Ref (?:no)?\.?\s*(\w+)/i)?.[1] ?? null;
      return {
        status: 'parsed',
        txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[1]), instrument: 'upi', referenceId: ref },
      };
    }
  }

  // ── UPI/account credit ───────────────────────────────────────────────────
  m = body.match(/Acct\s*(\w*\d{2,4}).*?credited with\s*(?:Rs|INR)\.?\s*([\d,]+\.?\d*).*?(?:from|by)\s*([^\s(.]+)/i);
  if (m) {
    const amount = parseAmount(m[2]);
    if (amount != null) {
      const ref = body.match(/UPI Ref (?:no)?\.?\s*(\w+)/i)?.[1] ?? null;
      return {
        status: 'parsed',
        txn: { amount, direction: 'credit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[1]), instrument: 'upi', referenceId: ref },
      };
    }
  }

  // ── Card transaction ─────────────────────────────────────────────────────
  m = body.match(/Transaction of\s*(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+on\s+ICICI Bank Card\s*(\w*\d{4}).*?at\s+(.+?)[.\n]/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return {
        status: 'parsed',
        txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[2]), instrument: 'card', referenceId: null },
      };
    }
  }

  return { status: 'unparsed' };
};
