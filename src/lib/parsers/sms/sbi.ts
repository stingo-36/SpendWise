/**
 * SBI SMS templates. SBI's UPI alert is the one that breaks every generic
 * matcher, because it states the amount with no currency marker at all:
 *   "Dear UPI user A/C X1234 debited by 100.0 on date 11Sep26 trf to SWIGGY
 *    Refno 501234567890 ..."
 */
import { EmailInput, ParseResult, parseAmount, parseDateTime } from '../types';
import { matchGenericSms, smsIgnoredReason, smsLast4, smsReference, smsMerchant } from './shared';

export function sbiSms(input: EmailInput): ParseResult {
  const text = input.bodyText;
  const ignored = smsIgnoredReason(text);
  if (ignored) return { status: 'ignored', reason: ignored };

  // "debited by 100.0" / "credited by 250" — bare number, no Rs prefix.
  const bare = text.match(/\b(debited|credited)\s+by\s+([\d,]+(?:\.\d{1,2})?)/i);
  if (bare) {
    const amount = parseAmount(bare[2]);
    if (amount != null && amount > 0) {
      return {
        status: 'parsed',
        txn: {
          amount,
          direction: bare[1].toLowerCase() === 'debited' ? 'debit' : 'credit',
          rawMerchant: smsMerchant(text) ?? 'Unknown',
          occurredAt: parseDateTime(text, input.receivedAt),
          accountLast4: smsLast4(text),
          instrument: /upi/i.test(text) ? 'upi' : 'netbanking',
          referenceId: smsReference(text),
        },
      };
    }
  }

  return matchGenericSms(input);
}
