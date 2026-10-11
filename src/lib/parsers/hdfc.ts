import { EmailInput, ParseResult, Parser, atmWithdrawal, ignoredReason, last4, parseAmount, parseDateTime } from './types';

/**
 * HDFC Bank "InstaAlerts" templates (alerts@hdfcbank.bank.in), plus older
 * formats kept as fallbacks. Match against subject + plaintext body.
 *
 * Real UPI debit (current format):
 *   "Rs.154.59 is debited from your account ending 5427 towards VPA
 *    payzomato@hdfcbank (ZOMATO) on 28-08-26. UPI transaction reference no.:
 *    156522854212."
 * The parenthetical (ZOMATO) is the clean merchant name — prefer it over the VPA.
 * For person-to-person transfers the parenthetical is the person's name.
 *
 * Real UPI credit:
 *   "Rs.2,000.00 is credited to your account ending 5427 ... VPA name@bank (NAME)
 *    on 28-08-26. UPI transaction reference no.: ..."
 */

// Prefer the parenthetical merchant name; fall back to the VPA handle.
function pickMerchant(vpa: string, parenthetical: string | undefined): string {
  const name = parenthetical?.trim();
  if (name) return name;
  return vpa.trim();
}


/**
 * Who sent the money, for an incoming NEFT/IMPS/UPI credit.
 *
 * Only "Reference Details:" was checked before, so almost every credit fell
 * back to the literal "BANK CREDIT" — the transactions list showed money
 * arriving with no idea who from. Indian banks bury the payer in a narration
 * whose shape depends on the rail, so try each known one in order of how
 * specific it is.
 */
function payerName(body: string): string | null {
  const patterns: RegExp[] = [
    // "...credited ... by VPA sahil@okhdfc (SAHIL TARI)" — parenthetical wins.
    /(?:by|from)\s+VPA\s+\S+\s*\(([^)]{2,40})\)/i,
    // IMPS narration: "IMPS-503412345678-SAHIL TARI-HDFC-XXXX-Payment"
    /\bIMPS[-\/](?:\w+[-\/])?([A-Za-z][A-Za-z .&']{2,40}?)[-\/]/i,
    // NEFT narration: "NEFT-CITIN12345678-SAHIL TARI-..."
    /\bNEFT[-\/](?:\w+[-\/])?([A-Za-z][A-Za-z .&']{2,40}?)[-\/]/i,
    // UPI narration: "UPI/512345678/Payment from/SAHIL TARI"
    /\bUPI[-\/].*?[-\/]([A-Za-z][A-Za-z .&']{2,40}?)(?:[-\/]|$)/im,
    // Explicit phrasings.
    /\b(?:received|credited)\s+from\s+([A-Za-z][A-Za-z .&']{2,40}?)(?=\s{2,}|[.,\n]|\s+on\b|$)/i,
    /\bdeposited\s+by\s+([A-Za-z][A-Za-z .&']{2,40}?)(?=\s{2,}|[.,\n]|$)/i,
    /\bsender(?:'s)?\s*(?:name)?\s*[:\-]\s*([A-Za-z][A-Za-z .&']{2,40})/i,
    /\bremitter\s*(?:name)?\s*[:\-]\s*([A-Za-z][A-Za-z .&']{2,40})/i,
    // Generic narration field, last resort.
    /Reference Details?:\s*([A-Za-z][\w .&\/-]{2,40})/i,
    /\b(?:Info|Narration|Remarks)\s*[:\-]\s*([A-Za-z][\w .&\/-]{2,40})/i,
  ];
  for (const re of patterns) {
    const name = body.match(re)?.[1]?.trim().replace(/\s{2,}/g, ' ');
    // Reject rail names and boilerplate that these narrations also contain.
    if (name && !/^(?:HDFC|ICICI|AXIS|SBI|BANK|NEFT|IMPS|UPI|FT|PAYMENT|TRANSFER|CR|DR)$/i.test(name)) {
      return name;
    }
  }
  return null;
}

export const hdfcParser: Parser = (email: EmailInput): ParseResult => {
  const ignore = ignoredReason(email);
  if (ignore) return { status: 'ignored', reason: ignore };

  const body = (email.bodyText || '').replace(/\s+/g, ' ');
  const when = parseDateTime(body, email.receivedAt);
  const ref = body.match(/UPI transaction reference no\.?:?\s*(\w+)/i)?.[1] ?? body.match(/reference number is\s*(\w+)/i)?.[1] ?? null;

  // ── ATM cash withdrawal ──────────────────────────────────────────────────
  // Checked before the UPI/card templates: a withdrawal names no payee, so
  // none of them can match it and it would otherwise fall through unparsed.
  const cash = atmWithdrawal(body, when, ref);
  if (cash) return { status: 'parsed', txn: cash };

  // ── InstaAlerts UPI debit ────────────────────────────────────────────────
  let m = body.match(
    /Rs\.?\s*([\d,]+\.?\d*)\s+is debited from your account ending\s*(\d{3,4})\s+towards VPA\s+(\S+?)\s*(?:\(([^)]+)\))?\s+on\b/i,
  );
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return {
        status: 'parsed',
        txn: { amount, direction: 'debit', rawMerchant: pickMerchant(m[3], m[4]), occurredAt: when, accountLast4: last4(m[2]), instrument: 'upi', referenceId: ref },
      };
    }
  }

  // ── InstaAlerts UPI credit ───────────────────────────────────────────────
  // HDFC masks the account three different ways across template vintages
  // ("ending 5427", "ending in 5427", "**1234", "XX1234") and introduces the
  // payer with either "from VPA" or "towards VPA" — accept all of them.
  m = body.match(
    /Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been |is )?credited to your account\s*(?:ending(?: in)?\s*|\**|XX)(\d{3,4})\s+(?:.*?)VPA\s+(\S+?)\s*(?:\(([^)]+)\))?\s+on\b/i,
  );
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return {
        status: 'parsed',
        txn: { amount, direction: 'credit', rawMerchant: pickMerchant(m[3], m[4]), occurredAt: when, accountLast4: last4(m[2]), instrument: 'upi', referenceId: ref },
      };
    }
  }

  // ── "deducted ... and added to <TARGET> account on" (EMI / ACH / mandate) ─
  m = body.match(/(?:Rs\.?\s*)?INR\s*([\d,]+\.?\d*)\s+is deducted from your account ending\s*(?:XX)?(\d{3,4})\s+and added to\s+(.+?)\s+account on\b/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      const instrument = /\bACH\b|EMI|mandate/i.test(m[3]) ? 'auto_debit' : 'netbanking';
      return {
        status: 'parsed',
        txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: last4(m[2]), instrument, referenceId: ref },
      };
    }
  }

  // ── Plain credit into own account (salary / NEFT / IMPS in) ──────────────
  m = body.match(/(?:Rs\.?\s*)?(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+(?:has been |is )?(?:successfully )?credited to your (?:HDFC Bank )?account\s*(?:ending(?: in)?\s*|\**|XX)(\d{3,4})/i);
  if (!m) m = body.match(/(?:Amount received:|received a credit).*?(?:Rs|INR)\.?\s*([\d,]+\.?\d*).*?(?:XX|ending(?: in)?\s*)(\d{3,4})/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return {
        status: 'parsed',
        txn: { amount, direction: 'credit', rawMerchant: payerName(body) || 'BANK CREDIT', occurredAt: when, accountLast4: last4(m[2]), instrument: 'netbanking', referenceId: ref },
      };
    }
  }

  // ── Card transaction — four known orderings ──────────────────────────────
  // (a) "...spent on Card ending 4471 at MERCHANT on ..."  [amount, last4, merchant]
  let card = body.match(/(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+(?:has been|is|was)?\s*(?:spent|used).*?Card\s+(?:ending|no\.?\s*(?:XX)?)\s*(\d{4})\s+(?:at|towards)\s+(.+?)\s+on\b/i);
  let cardAmount: string | undefined, cardLast4: string | undefined, cardMerchant: string | undefined;
  if (card) {
    [, cardAmount, cardLast4, cardMerchant] = card;
  } else {
    // (b) "Card ending 4471 for Rs.X at MERCHANT on ..."  [last4, amount, merchant]
    card = body.match(/Card ending\s*(\d{4})\s+for\s+(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+at\s+(.+?)\s+on\b/i);
    if (card) [, cardLast4, cardAmount, cardMerchant] = card;
  }
  if (!card) {
    // (c) Debit card purchase: "Rs.799.00 is debited from your HDFC Bank Debit
    //     Card ending 6926 at ZEE ENTERTAINMENT on 11 Jun, 2026 at 22:37:53."
    //     (a) demands "spent"/"used", which this shape never says, so every
    //     debit-card purchase was landing in parser-health instead of the
    //     ledger. "from your …Card" is matched across word characters only, so
    //     it cannot leap a sentence into the "BLOCK DEBIT CARD 6926" footer.
    card = body.match(
      /(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+(?:has been|is|was)?\s*debited from your\s+[\w ]*?Card\s+(?:ending|no\.?\s*(?:XX)?)\s*(\d{4})\s+(?:at|towards)\s+(.+?)\s+on\b/i,
    );
    if (card) [, cardAmount, cardLast4, cardMerchant] = card;
  }
  if (!card) {
    // (d) Credit card alert: "Thank you for using your HDFC Bank Credit Card
    //     ending in 7856 .You made a transaction of Rs. 720.00 at RAZ*Swiggy
    //     on 12-07-2026 17:58:49". Card first, amount second, and "ending in"
    //     rather than "ending" — none of the above reach it.
    card = body.match(
      /Card\s+ending(?:\s+in)?\s*(\d{4})\s*\.?\s*You made a transaction of\s+(?:Rs|INR)\.?\s*([\d,]+\.?\d*)\s+at\s+(.+?)\s+on\b/i,
    );
    if (card) [, cardLast4, cardAmount, cardMerchant] = card;
  }
  if (cardAmount && cardLast4 && cardMerchant) {
    const amount = parseAmount(cardAmount);
    if (amount != null) {
      return {
        status: 'parsed',
        txn: { amount, direction: 'debit', rawMerchant: cardMerchant.trim(), occurredAt: when, accountLast4: cardLast4, instrument: 'card', referenceId: null },
      };
    }
  }

  // ── Legacy: "debited from account **1234 to VPA X on" ────────────────────
  m = body.match(/Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been|is)?\s*debited from (?:your )?account\s*\**(\d{2,4})?\s*to (?:VPA )?([^\s.]+)/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return {
        status: 'parsed',
        txn: { amount, direction: 'debit', rawMerchant: m[3].trim(), occurredAt: when, accountLast4: m[2] ? last4(m[2]) : null, instrument: 'upi', referenceId: ref },
      };
    }
  }

  // ── Generic netbanking/IMPS debit fallback ───────────────────────────────
  m = body.match(/Rs\.?\s*([\d,]+\.?\d*)\s+(?:has been )?debited.*?(?:towards|to)\s+(.+?)\s+(?:on|via)\b/i);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount != null) {
      return {
        status: 'parsed',
        txn: { amount, direction: 'debit', rawMerchant: m[2].trim(), occurredAt: when, accountLast4: null, instrument: 'netbanking', referenceId: ref },
      };
    }
  }

  return { status: 'unparsed' };
};
