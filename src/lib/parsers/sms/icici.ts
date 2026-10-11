/**
 * ICICI SMS templates:
 *   "ICICI Bank Acct XX123 debited for Rs 500.00 on 11-Sep-26; SWIGGY credited.
 *    UPI:501234567890."
 * The trailing "<payee> credited" is the merchant — the generic "to <x>"
 * shapes never see it.
 */
import { EmailInput, ParseResult, parseAmount, parseDateTime } from '../types';
import { matchGenericSms, smsIgnoredReason, smsLast4, smsReference } from './shared';

export function iciciSms(input: EmailInput): ParseResult {
  const text = input.bodyText;
  const ignored = smsIgnoredReason(text);
  if (ignored) return { status: 'ignored', reason: ignored };

  const m = text.match(/debited\s+for\s+(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)\s+on\s+[^;]+;\s*([^\n]+?)\s+credited/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null && amount > 0) {
      return {
        status: 'parsed',
        txn: {
          amount,
          direction: 'debit',
          rawMerchant: m[2].trim().replace(/\s+/g, ' '),
          occurredAt: parseDateTime(text, input.receivedAt),
          accountLast4: smsLast4(text),
          instrument: /upi/i.test(text) ? 'upi' : 'netbanking',
          referenceId: smsReference(text) ?? (text.match(/UPI[:\s]*(\d{6,})/i)?.[1] ?? null),
        },
      };
    }
  }

  return matchGenericSms(input);
}
