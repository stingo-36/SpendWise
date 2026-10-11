/**
 * Transaction de-duplication cleanup (§5.3, after the fact).
 *
 * parsePass refuses to *create* a duplicate, but rows inserted before that
 * guard existed — chiefly by two sync pipelines racing each other — are already
 * in the table. This sweeps them up, and runs as a step of every sync so the
 * ledger self-heals without anyone running a script.
 *
 * Three passes. The first two are restricted to Gmail-derived rows
 * (raw_email_id NOT NULL) so manually added or restored transactions are
 * never touched:
 *
 *   1. exact  — several transactions pointing at the SAME raw email. Only a
 *               concurrent parse can produce these; always a duplicate.
 *   2. fuzzy  — different emails, same fingerprint (amount + direction +
 *               ±3 min + compatible last4). This is the same rule parsePass
 *               uses to merge sibling alerts for one purchase, applied to rows
 *               that slipped in while two passes ran side by side.
 *   3. mandate — an auto-debit alert and a later bank/netbanking alert for the
 *                same mandate. Banks can send these hours apart, so this uses
 *                a deliberately narrower same-day merchant match. It also
 *                accepts imported Gmail/SMS rows whose raw-email link was not
 *                included in the export.
 *
 * The surviving row is the one the user has invested in (locked > categorised >
 * annotated), ties going to the oldest id, and it inherits anything the losers
 * had that it lacked.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { normalizeMerchant } from './merchant';

const DEDUPE_WINDOW_MS = 3 * 60 * 1000; // ±3 minutes — matches parsePass
const AUTO_DEBIT_WINDOW_MS = 12 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

const MERCHANT_NOISE = new Set([
  'AUTO', 'DEBIT', 'ACH', 'NACH', 'MANDATE', 'PAYMENT', 'BANK', 'FINANCIAL',
  'FINANCE', 'SERVICE', 'SERVICES', 'LIMITED', 'PRIVATE', 'PVT', 'LTD', 'WITH',
  'UMRN', 'TRANSACTION',
]);

export interface DedupeResult {
  groups: number; // duplicate clusters found
  removed: number; // extra rows deleted
}

type Row = Prisma.TransactionGetPayload<{}>;

/** How much user intent a row carries; the highest scorer survives. */
function score(t: Row): number {
  return (
    (t.categoryLocked ? 16 : 0) +
    (t.categoryId != null ? 8 : 0) +
    (t.notes ? 4 : 0) +
    (t.displayLabel ? 2 : 0) +
    (t.subscriptionId != null ? 1 : 0)
  );
}

/** Pick the survivor: most user intent, oldest id on a tie. */
function pickKeeper(rows: Row[]): Row {
  return rows.reduce((best, r) => {
    const d = score(r) - score(best);
    return d > 0 || (d === 0 && r.id < best.id) ? r : best;
  }, rows[0]);
}

/** last4 conflicts only when BOTH rows carry one — same rule as parsePass. */
function last4Compatible(a: Row, b: Row): boolean {
  return !(a.accountLast4 && b.accountLast4 && a.accountLast4 !== b.accountLast4);
}

type AutoDebitComparable = Pick<Row, 'instrument' | 'occurredAt' | 'rawMerchant' | 'merchant' | 'displayLabel'>;

function istDay(d: Date): number {
  return Math.floor((d.getTime() + IST_OFFSET_MS) / 86_400_000);
}

function merchantTokens(t: AutoDebitComparable): Set<string> {
  const text = [t.rawMerchant, t.merchant, t.displayLabel].filter(Boolean).join(' ').toUpperCase();
  return new Set(
    text
      .split(/[^A-Z0-9]+/)
      .filter((token) => token.length >= 4 && !MERCHANT_NOISE.has(token) && !/^\d+$/.test(token)),
  );
}

/**
 * Match the two shapes banks emit for one mandate debit. This intentionally
 * does not treat two ordinary netbanking rows, or two auto-debit rows, as the
 * same transaction: exactly one side must be the mandate alert.
 */
export function isMatchingAutoDebitAlert(a: AutoDebitComparable, b: AutoDebitComparable): boolean {
  if ((a.instrument === 'auto_debit') === (b.instrument === 'auto_debit')) return false;
  const gap = Math.abs(a.occurredAt.getTime() - b.occurredAt.getTime());
  if (gap > AUTO_DEBIT_WINDOW_MS || istDay(a.occurredAt) !== istDay(b.occurredAt)) return false;

  const aTokens = merchantTokens(a);
  const bTokens = merchantTokens(b);
  return [...aTokens].some((token) => bTokens.has(token));
}

/** Fold the losers' detail into the keeper, then delete them. */
async function collapse(keeper: Row, losers: Row[]): Promise<void> {
  // The richest merchant string is simply the most descriptive one. Only
  // re-normalize when it actually changed: the keeper's own display name is
  // not ours to rewrite. displayLabel is never touched either way.
  let rawMerchant = keeper.rawMerchant;
  for (const l of losers) if (l.rawMerchant.length > rawMerchant.length) rawMerchant = l.rawMerchant;
  const merchantChanged = rawMerchant !== keeper.rawMerchant;

  await prisma.transaction.update({
    where: { id: keeper.id },
    data: {
      rawMerchant,
      merchant: merchantChanged ? normalizeMerchant(rawMerchant) : keeper.merchant,
      referenceId: keeper.referenceId ?? losers.find((l) => l.referenceId)?.referenceId ?? null,
      accountLast4: keeper.accountLast4 ?? losers.find((l) => l.accountLast4)?.accountLast4 ?? null,
      // A card flag on any copy wins: registering the card retro-flags rows.
      isCreditCard: keeper.isCreditCard || losers.some((l) => l.isCreditCard),
    },
  });

  await prisma.transaction.deleteMany({ where: { id: { in: losers.map((l) => l.id) } } });

  // Leave a trail on the emails whose transaction went away, so parser-health
  // doesn't show them as silently unaccounted for.
  const emailIds = losers.map((l) => l.rawEmailId).filter((id): id is number => id != null && id !== keeper.rawEmailId);
  if (emailIds.length) {
    await prisma.rawEmail.updateMany({
      where: { id: { in: emailIds } },
      data: { parseStatus: 'parsed', parseError: `merged into txn ${keeper.id}` },
    });
  }
}

/** Pass 1: several transactions for one raw email. */
async function dedupeByEmail(userId: number, apply: boolean, log: (s: string) => void): Promise<DedupeResult> {
  const groups = await prisma.$queryRaw<{ raw_email_id: number }[]>`
    SELECT raw_email_id
    FROM transactions
    WHERE user_id = ${userId} AND raw_email_id IS NOT NULL
    GROUP BY raw_email_id
    HAVING COUNT(*) > 1
  `;

  const res: DedupeResult = { groups: 0, removed: 0 };

  for (const g of groups) {
    const rows = await prisma.transaction.findMany({ where: { userId, rawEmailId: g.raw_email_id }, orderBy: { id: 'asc' } });
    if (rows.length < 2) continue;
    const keeper = pickKeeper(rows);
    const losers = rows.filter((r) => r.id !== keeper.id);
    res.groups++;
    res.removed += losers.length;
    log(`  email ${g.raw_email_id}: ${rows.length}× ${keeper.merchant} ${keeper.amount} → keep #${keeper.id}, drop ${losers.map((l) => `#${l.id}`).join(', ')}`);
    if (apply) await collapse(keeper, losers);
  }

  return res;
}

/** Pass 2: distinct emails that describe the same purchase. */
async function dedupeByFingerprint(userId: number, sinceDays: number | null, apply: boolean, log: (s: string) => void): Promise<DedupeResult> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      rawEmailId: { not: null },
      ...(sinceDays ? { occurredAt: { gte: new Date(Date.now() - sinceDays * 86_400_000) } } : {}),
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });

  const res: DedupeResult = { groups: 0, removed: 0 };
  const taken = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    if (taken.has(rows[i].id)) continue;
    const cluster = [rows[i]];

    // Rows are date-ordered, so the window ends as soon as one falls outside it.
    for (let j = i + 1; j < rows.length; j++) {
      const gap = rows[j].occurredAt.getTime() - rows[i].occurredAt.getTime();
      if (gap > DEDUPE_WINDOW_MS) break;
      if (taken.has(rows[j].id)) continue;
      if (!rows[j].amount.equals(rows[i].amount)) continue;
      if (rows[j].direction !== rows[i].direction) continue;
      if (!last4Compatible(rows[i], rows[j])) continue;
      cluster.push(rows[j]);
    }

    if (cluster.length < 2) continue;
    cluster.forEach((r) => taken.add(r.id));
    const keeper = pickKeeper(cluster);
    const losers = cluster.filter((r) => r.id !== keeper.id);
    res.groups++;
    res.removed += losers.length;
    log(`  fingerprint ${keeper.merchant} ${keeper.amount} @ ${keeper.occurredAt.toISOString()}: keep #${keeper.id}, drop ${losers.map((l) => `#${l.id}`).join(', ')}`);
    if (apply) await collapse(keeper, losers);
  }

  return res;
}

/** Pass 3: a mandate alert and its later account-debit confirmation. */
async function dedupeAutoDebits(userId: number, sinceDays: number | null, apply: boolean, log: (s: string) => void): Promise<DedupeResult> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      source: { in: ['gmail', 'sms'] },
      ...(sinceDays ? { occurredAt: { gte: new Date(Date.now() - sinceDays * 86_400_000) } } : {}),
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });

  const res: DedupeResult = { groups: 0, removed: 0 };
  const taken = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    const base = rows[i];
    if (taken.has(base.id) || base.instrument !== 'auto_debit') continue;

    const match = rows.find((candidate) => {
      if (candidate.id === base.id || taken.has(candidate.id)) return false;
      if (!candidate.amount.equals(base.amount) || candidate.direction !== base.direction) return false;
      if (!last4Compatible(base, candidate)) return false;
      return isMatchingAutoDebitAlert(base, candidate);
    });
    if (!match) continue;

    taken.add(base.id);
    taken.add(match.id);
    // The auto-debit row is the canonical event; fold any richer categorisation
    // or bank reference from the confirmation into it.
    res.groups++;
    res.removed++;
    log(`  auto-debit ${base.merchant} ${base.amount}: keep #${base.id}, drop #${match.id}`);
    if (apply) await collapse(base, [match]);
  }

  return res;
}

export interface DedupeOptions {
  /** Only look at transactions this recent in the fingerprint pass. null = all. */
  sinceDays?: number | null;
  /** false reports what it would do without touching anything. */
  apply?: boolean;
  /** Where the per-cluster detail goes. Silent by default. */
  log?: (s: string) => void;
}

/** Remove duplicate transactions for one user. Safe to run repeatedly. */
export async function dedupeTransactions(userId: number, opts: DedupeOptions = {}): Promise<DedupeResult> {
  const { sinceDays = null, apply = true, log = () => {} } = opts;

  const a = await dedupeByEmail(userId, apply, log);
  const b = await dedupeByFingerprint(userId, sinceDays, apply, log);
  const c = await dedupeAutoDebits(userId, sinceDays, apply, log);

  const res = { groups: a.groups + b.groups + c.groups, removed: a.removed + b.removed + c.removed };
  if (res.removed) console.log(`[dedupe] user ${userId}: removed ${res.removed} duplicate transactions in ${res.groups} clusters`);
  return res;
}
