/**
 * Axis SMS templates:
 *   "Spent Card no. XX4821 INR 499 11-09-26 NETFLIX Avl Lmt INR 48000"
 * The merchant sits between the date and "Avl Lmt", with no keyword in front
 * of it, so it needs its own shape.
 */
import { EmailInput, ParseResult, parseAmount, parseDateTime } from '../types';
import { matchGenericSms, smsIgnoredReason, smsLast4, smsReference } from './shared';

export function axisSms(input: EmailInput): ParseResult {
  const text = input.bodyText;
  const ignored = smsIgnoredReason(text);
  if (ignored) return { status: 'ignored', reason: ignored };

  const m = text.match(
    /spent\s+card\s+no\.?\s*\S*?(\d{4})\s+(?:inr|rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s+(\S+)\s+([^\n]+?)(?=\s+avl\b|\s+ref\b|$)/i,
  );
  if (m) {
    const amount = parseAmount(m[2]);
    if (amount != null && amount > 0) {
      return {
        status: 'parsed',
        txn: {
          amount,
          direction: 'debit',
          rawMerchant: m[4].trim().replace(/\s+/g, ' '),
          occurredAt: parseDateTime(text, input.receivedAt),
          accountLast4: m[1],
          instrument: 'card',
          referenceId: smsReference(text),
        },
      };
    }
  }

  return matchGenericSms(input);
}
