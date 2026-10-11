/**
 * Shared matching for SMS alerts.
 *
 * Bank SMS is far terser than the email templates in ../: no subject, no HTML,
 * ~160 characters, and the merchant is often the trailing fragment before a
 * reference number. The generic amount/date/last4 helpers from ../types still
 * apply — only the surrounding shapes differ, so they live here rather than
 * being duplicated per bank.
 */
import { EmailInput, Instrument, ParseResult, parseAmount, parseDateTime, last4 } from '../types';

/** Amount written as "Rs.1,234.50", "INR 1234.50", "Rs 499". */
const AMOUNT = String.raw`(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)`;

/** Non-transaction SMS: OTP, balance, promo, mandate notices. */
export function smsIgnoredReason(text: string): string | null {
  const t = text.toLowerCase();
  const movedMoney = /debited|credited|spent|withdraw(n|al)?|paid|received/.test(t);

  if (/\botp\b|one[- ]time password|verification code|do not share/.test(t)) return 'otp';
  if (/avl bal|available balance|a\/c balance|bal:/.test(t) && !movedMoney) return 'balance';
  if (/e-?mandate|autopay|mandate/.test(t) && !movedMoney) return 'mandate_notice';
  if (/offer|cashback|pre-?approved|apply now|click|loan|congratulations/.test(t) && !movedMoney) return 'promo';
  // "will be debited" / "due on" are notices about future money, not a txn.
  if (/will be (debited|deducted)|due on|reminder/.test(t) && !/has been|was /.test(t)) return 'notice';
  return null;
}

/** Instrument inferred from the wording of the alert. */
export function smsInstrument(text: string): Instrument {
  const t = text.toLowerCase();
  if (/\bupi\b|vpa|@[a-z]/.test(t)) return 'upi';
  if (/atm|cash withdrawal|withdrawn at/.test(t)) return 'atm';
  if (/credit card|debit card|card ending|card no|txn at|purchase at/.test(t)) return 'card';
  if (/neft|imps|rtgs|net ?banking|transfer/.test(t)) return 'netbanking';
  if (/auto ?debit|si |standing instruction|nach/.test(t)) return 'auto_debit';
  return 'unknown';
}

/** Reference/UPI/txn number, when the alert carries one. */
export function smsReference(text: string): string | null {
  const m = text.match(/(?:ref(?:erence)?(?:\s*no\.?)?|txn(?:\s*(?:no|id))?|utr)[:\s#]*([A-Za-z0-9]{6,})/i);
  return m ? m[1] : null;
}

/**
 * The merchant/counterparty. SMS puts it after "at", "to", "VPA", or
 * "towards"; it runs until a reference number, a date, or the end.
 *
 * Every capture also stops at "from" and at the balance tail ("Avl Bal"):
 * a withdrawal reads "withdrawn at HDFC BANK ATM KORAMANGALA from A/c XX5427",
 * and without those the merchant kept the account token glued to the place.
 */
const MERCHANT_END = String.raw`(?=\s+on\b|\s+from\b|\s+ref|\s+txn|\s+upi|\s+avl\b|\s+bal\b|[.;]|$)`;

function merchantRe(prefix: string): RegExp {
  return new RegExp(prefix + String.raw`([^\n.;]+?)` + MERCHANT_END, 'i');
}

export function smsMerchant(text: string): string | null {
  const patterns = [
    merchantRe(String.raw`\bto\s+VPA\s+`),
    merchantRe(String.raw`\btrf\s+to\s+`),
    merchantRe(String.raw`\bat\s+`),
    merchantRe(String.raw`\bto\s+`),
    merchantRe(String.raw`\btowards\s+`),
    merchantRe(String.raw`\bfrom\s+`),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const raw = m[1].trim().replace(/\s+/g, ' ');
      // Guard against capturing a bare account token ("A/c XX1234").
      if (raw && !/^(a\/c|ac|acct|account)\b/i.test(raw) && raw.length > 2) return raw;
    }
  }
  return null;
}

/** The masked account/card the alert is about. */
export function smsLast4(text: string): string | null {
  const m = text.match(/(?:a\/c|ac|acct|account|card)\s*(?:no\.?)?\s*(?:x+|\*+|ending\s*)?\s*(\d{3,6})/i);
  if (m) return last4(m[1]);
  const masked = text.match(/(?:X{2,}|\*{2,})(\d{4})/);
  return masked ? masked[1] : null;
}

/**
 * The merchant to file a transaction under.
 *
 * A withdrawal names no counterparty, so "Unknown" was the merchant for every
 * cash SMS that didn't spell out the ATM's location — and a list of "Unknown"
 * rows tells you nothing. Name it for what it is instead; the seeded rules
 * then file it under Transfers › Cash withdrawal.
 *
 * A withdrawal whose only "from"/"at" phrase is the account it came out of
 * ("From HDFC Bank A/C x5427 Cash Withdrawal") gets the same treatment: the
 * account is not a merchant, and keeping it would give every withdrawal from
 * one account a different name.
 */
function merchantFor(text: string, instrument: Instrument): string {
  const found = smsMerchant(text);
  if (instrument === 'atm' && (!found || /\ba\/?c\b|\bacct\b|\baccount\b|\b[xX*]+\d{3,6}\b/.test(found))) {
    return 'ATM Withdrawal';
  }
  return found ?? 'Unknown';
}

/**
 * The common debit/credit shape shared by every Indian bank's SMS. A bank
 * module calls this first and only adds its own templates for what it misses.
 */
export function matchGenericSms(input: EmailInput): ParseResult {
  const text = input.bodyText;

  const ignored = smsIgnoredReason(text);
  if (ignored) return { status: 'ignored', reason: ignored };

  // Direction: the verb decides. "debited"/"spent"/"withdrawn" vs "credited".
  // The noun forms count too: HDFC writes "Cash Withdrawal" and "ATM WDL"
  // rather than "withdrawn", and those alerts matched no verb at all.
  const debit = /\b(debited|spent|withdraw(n|al)?|wdl|paid|purchase|deducted)\b/i.test(text);
  const credit = /\b(credited|received|refund(?:ed)?)\b/i.test(text);
  if (!debit && !credit) return { status: 'unparsed' };

  const amountMatch = text.match(new RegExp(AMOUNT, 'i'));
  if (!amountMatch) return { status: 'unparsed' };
  const amount = parseAmount(amountMatch[1]);
  if (amount == null || amount <= 0) return { status: 'unparsed' };

  const instrument = smsInstrument(text);
  const merchant = merchantFor(text, instrument);

  return {
    status: 'parsed',
    txn: {
      amount,
      // A message containing both verbs is a debit that mentions a refund
      // window etc.; the debit reading is the safe one.
      direction: debit ? 'debit' : 'credit',
      rawMerchant: merchant,
      occurredAt: parseDateTime(text, input.receivedAt),
      accountLast4: smsLast4(text),
      instrument,
      referenceId: smsReference(text),
    },
  };
}
