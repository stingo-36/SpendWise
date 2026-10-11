/**
 * Parse pass (spec §5): a separate, re-runnable stage over stored raw_emails.
 * A parser bug is fixed by re-running this over raw data — never by re-fetching.
 *
 * Includes §5.3 deduplication: one purchase can generate several messages, so
 * before inserting we look for an existing transaction matching amount +
 * ±3-minute window + direction + (account_last4 when both present).
 *
 * The same fingerprint is checked against deleted_transactions, so a row the
 * user removed is not resurrected by a sibling alert on the next pass.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { parseEmail } from './parsers';
import { parseSms } from './parsers/sms';
import { normalizeMerchant } from './merchant';
import type { ParsedTxn } from './parsers/types';
import { creditCardLast4s } from './creditCards';
import { isMatchingAutoDebitAlert } from './dedupe';

const DEDUPE_WINDOW_MS = 3 * 60 * 1000; // ±3 minutes
const AUTO_DEBIT_WINDOW_MS = 12 * 60 * 60 * 1000;

export interface ParsePassResult {
  processed: number;
  parsed: number;
  ignored: number;
  unparsed: number;
  merged: number;
  errors: number;
}

/**
 * Find an existing transaction that this parsed txn duplicates (§5.3).
 * Returns it, or null.
 */
async function findDuplicate(userId: number, txn: ParsedTxn) {
  const lo = new Date(txn.occurredAt.getTime() - AUTO_DEBIT_WINDOW_MS);
  const hi = new Date(txn.occurredAt.getTime() + AUTO_DEBIT_WINDOW_MS);

  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      amount: new Prisma.Decimal(txn.amount),
      direction: txn.direction,
      occurredAt: { gte: lo, lte: hi },
    },
  });

  for (const c of candidates) {
    // account_last4 must match only when BOTH are non-null.
    if (txn.accountLast4 && c.accountLast4 && txn.accountLast4 !== c.accountLast4) continue;
    const gap = Math.abs(txn.occurredAt.getTime() - c.occurredAt.getTime());
    if (gap <= DEDUPE_WINDOW_MS || isMatchingAutoDebitAlert(c, {
      instrument: txn.instrument,
      occurredAt: txn.occurredAt,
      rawMerchant: txn.rawMerchant,
      merchant: normalizeMerchant(txn.rawMerchant),
      displayLabel: null,
    })) return c;
  }
  return null;
}

/**
 * True when the user has already deleted this transaction. Uses the same
 * fingerprint as findDuplicate so a second alert for a deleted purchase — or a
 * re-parse of the mailbox — cannot bring it back.
 */
async function wasDeleted(userId: number, txn: ParsedTxn) {
  const lo = new Date(txn.occurredAt.getTime() - DEDUPE_WINDOW_MS);
  const hi = new Date(txn.occurredAt.getTime() + DEDUPE_WINDOW_MS);

  const tombstones = await prisma.deletedTransaction.findMany({
    where: {
      userId,
      amount: new Prisma.Decimal(txn.amount),
      direction: txn.direction,
      occurredAt: { gte: lo, lte: hi },
    },
  });

  return tombstones.some((t) => !(txn.accountLast4 && t.accountLast4 && txn.accountLast4 !== t.accountLast4));
}

/** A richer merchant string is simply the longer, more descriptive one. */
function richer(a: string, b: string): string {
  return b.length > a.length ? b : a;
}

/**
 * Run one parse pass over pending raw_emails. `limit` caps a single batch.
 *
 * `retryUnparsed` puts mail that matched no template back in the queue. Every
 * improvement to a bank template used to be worth nothing to the mail already
 * in the database: a pass only ever looked at `pending`, so an email marked
 * `unparsed` under the old templates stayed unparsed forever and the money it
 * described never appeared, however good the parser later became. `ignored`
 * is deliberately left alone — an OTP or a promo is not a missed transaction —
 * and so is `parsed`, which would duplicate.
 */
export async function runParsePass(
  userId: number,
  limit = 500,
  { retryUnparsed = false }: { retryUnparsed?: boolean } = {},
): Promise<ParsePassResult> {
  if (retryUnparsed) {
    await prisma.rawEmail.updateMany({
      where: { userId, parseStatus: 'unparsed' },
      data: { parseStatus: 'pending', parseError: null },
    });
  }

  const pending = await prisma.rawEmail.findMany({
    where: { userId, parseStatus: 'pending' },
    orderBy: { receivedAt: 'asc' },
    take: limit,
  });

  const res: ParsePassResult = { processed: 0, parsed: 0, ignored: 0, unparsed: 0, merged: 0, errors: 0 };

  // Card alerts don't distinguish credit from debit cards — the user's
  // registered last-4s do (see lib/creditCards.ts).
  const ccLast4 = await creditCardLast4s(userId);

  for (const email of pending) {
    res.processed++;
    try {
      const input = {
        sender: email.sender,
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        receivedAt: email.receivedAt,
      };
      // SMS rows share this table but carry a DLT header ("VM-HDFCBK") where
      // an email carries a From: address, so the '@' decides the dispatch.
      const result = email.sender.includes('@') ? parseEmail(input) : parseSms(input);

      if (result.status === 'ignored') {
        await prisma.rawEmail.update({ where: { id: email.id }, data: { parseStatus: 'ignored', parseError: null } });
        res.ignored++;
        continue;
      }
      if (result.status === 'unparsed') {
        await prisma.rawEmail.update({ where: { id: email.id }, data: { parseStatus: 'unparsed', parseError: 'no template matched' } });
        res.unparsed++;
        continue;
      }

      const txn = result.txn;

      const merchant = normalizeMerchant(txn.rawMerchant);

      if (await wasDeleted(email.userId, txn)) {
        await prisma.rawEmail.update({
          where: { id: email.id },
          data: { parseStatus: 'ignored', parseError: 'deleted by user' },
        });
        res.ignored++;
        continue;
      }

      const dup = await findDuplicate(email.userId, txn);
      if (dup) {
        // Keep existing; prefer the richer merchant. Log the merge (§5.3).
        const bestRaw = richer(dup.rawMerchant, txn.rawMerchant);
        const bestMerchant = normalizeMerchant(bestRaw);
        await prisma.transaction.update({
          where: { id: dup.id },
          data: {
            rawMerchant: bestRaw,
            merchant: bestMerchant,
            referenceId: dup.referenceId ?? txn.referenceId,
            accountLast4: dup.accountLast4 ?? txn.accountLast4,
          },
        });
        await prisma.rawEmail.update({ where: { id: email.id }, data: { parseStatus: 'parsed', parseError: `merged into txn ${dup.id}` } });
        console.log(`[parse] merged raw_email ${email.id} into txn ${dup.id} (${bestMerchant})`);
        res.merged++;
        continue;
      }

      // Belt as well as braces: on a database that predates the
      // unique(user_id, raw_email_id) index, this is what stops a re-parse or a
      // second pass from inserting the same email twice.
      const already = await prisma.transaction.findFirst({ where: { userId: email.userId, rawEmailId: email.id }, select: { id: true } });
      if (already) {
        await prisma.rawEmail.update({ where: { id: email.id }, data: { parseStatus: 'parsed', parseError: `already txn ${already.id}` } });
        res.merged++;
        continue;
      }

      try {
        await prisma.transaction.create({
          data: {
            userId: email.userId,
            rawEmailId: email.id,
            source: 'gmail',
            amount: new Prisma.Decimal(txn.amount),
            direction: txn.direction,
            occurredAt: txn.occurredAt,
            rawMerchant: txn.rawMerchant,
            merchant,
            accountLast4: txn.accountLast4,
            instrument: txn.instrument,
            referenceId: txn.referenceId,
            isCreditCard: txn.instrument === 'card' && txn.accountLast4 != null && ccLast4.has(txn.accountLast4),
            categorySource: 'unassigned',
          },
        });
        res.parsed++;
      } catch (err: any) {
        // Unique (user_id, raw_email_id): a concurrent pass already inserted this
        // one. Last line of defence behind the pipeline lock — not an error.
        if (err?.code !== 'P2002') throw err;
        res.merged++;
      }
      await prisma.rawEmail.update({ where: { id: email.id }, data: { parseStatus: 'parsed', parseError: null } });
    } catch (err) {
      res.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.rawEmail.update({ where: { id: email.id }, data: { parseStatus: 'unparsed', parseError: `error: ${msg}` } });
      console.error(`[parse] error on raw_email ${email.id}:`, msg);
    }
  }

  return res;
}
