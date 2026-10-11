import { EmailInput, ParseResult, Parser, atmWithdrawal, ignoredReason, last4, parseAmount, parseDateTime } from './types';

/**
 * SBI / SBI Card alert templates.
 * Debit example: "Rs.850.00 debited from A/c XX4567 on 28-08-26 to M/s DMART
 *  via UPI Ref 422011223344."
 */
export const sbiParser: Parser = (email: EmailInput): ParseResult => {
  const ignore = ignoredReason(email);
  if (ignore) return { status: 'ignored', reason: ignore };

  const body = email.bodyText || '';
  const when = parseDateTime(body, email.receivedAt);

  // ── ATM cash withdrawal ──────────────────────────────────────────────────
  // "Rs.2000 withdrawn at SBI ATM <id> from A/c X4567" has no "to <payee>",
  // so the debit template below never matched it.
  const cash = atmWithdrawal(body, when, body.match(/(?:UPI )?Ref\.?\s*(?:no)?\.?\s*(\w+)/i)?.[1] ?? null);
  if (cash) return { status: 'parsed', txn: cash };

  let m = body.match(/Rs\.?\s*([\d,]+\.?\d*)\s+debited from A\/c\s*(\w*\d{2,4}).*?to\s+(?:M\/s\s+)?(.+?)\s+(?:via|on|Ref)/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      const ref = body.match(/(?:UPI )?Ref\.?\s*(?:no)?\.?\s*(\w+)/i)?.[1] ?? null;
      const instrument = /via UPI/i.test(body) ? 'upi' : 'netbanking';
      return { status: 'parsed', txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[2]), instrument, referenceId: ref } };
    }
  }

  m = body.match(/Rs\.?\s*([\d,]+\.?\d*)\s+credited to A\/c\s*(\w*\d{2,4}).*?(?:from|by)\s+(.+?)\s+(?:via|on|Ref)/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return { status: 'parsed', txn: { amount, direction: 'credit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[2]), instrument: 'netbanking', referenceId: null } };
    }
  }

  // SBI Card spend
  m = body.match(/(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+spent on (?:your )?SBI Card\s*(\w*\d{4}).*?at\s+(.+?)\s+on/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return { status: 'parsed', txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[2]), instrument: 'card', referenceId: null } };
    }
  }

  return { status: 'unparsed' };
};
