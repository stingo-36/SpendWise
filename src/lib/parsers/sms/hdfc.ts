/**
 * HDFC SMS templates. The two that matter:
 *   "Sent Rs.890.50 From HDFC Bank A/C *1234 To SWIGGY On 11-09-26 Ref 5012..."
 *   "Spent Rs.499 On HDFC Bank CREDIT Card xx4821 At NETFLIX On 2026-09-11..."
 */
import { EmailInput, ParseResult, parseAmount, parseDateTime } from '../types';
import { matchGenericSms, smsIgnoredReason, smsLast4, smsReference } from './shared';

export function hdfcSms(input: EmailInput): ParseResult {
  const text = input.bodyText;
  const ignored = smsIgnoredReason(text);
  if (ignored) return { status: 'ignored', reason: ignored };

  // "Sent Rs.X From ... To <payee> On <date>" — HDFC's UPI debit.
  const sent = text.match(/sent\s+(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)\s+from\s+.*?\bto\s+([^\n]+?)(?=\s+on\b|\s+ref\b|$)/i);
  if (sent) {
    const amount = parseAmount(sent[1]);
    if (amount != null && amount > 0) {
      return {
        status: 'parsed',
        txn: {
          amount,
          direction: 'debit',
          rawMerchant: sent[2].trim().replace(/\s+/g, ' '),
          occurredAt: parseDateTime(text, input.receivedAt),
          accountLast4: smsLast4(text),
          instrument: 'upi',
          referenceId: smsReference(text),
        },
      };
    }
  }

  // "Spent Rs.X On HDFC Bank Card xx1234 At <merchant> On <date>".
  const spent = text.match(/spent\s+(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)\s+on\s+.*?\bat\s+([^\n]+?)(?=\s+on\b|\s+ref\b|$)/i);
  if (spent) {
    const amount = parseAmount(spent[1]);
    if (amount != null && amount > 0) {
      return {
        status: 'parsed',
        txn: {
          amount,
          direction: 'debit',
          rawMerchant: spent[2].trim().replace(/\s+/g, ' '),
          occurredAt: parseDateTime(text, input.receivedAt),
          accountLast4: smsLast4(text),
          instrument: 'card',
          referenceId: smsReference(text),
        },
      };
    }
  }

  return matchGenericSms(input);
}
