/**
 * Credit-card registry. Bank alert emails don't say whether a card is credit or
 * debit — both arrive as `instrument: 'card'` — so the user tells us which
 * last-4s are credit cards. Everything else is treated as account money.
 */
import { prisma } from './db';

export interface CreditCardRow {
  id: number;
  last4: string;
  label: string;
  txnCount: number;
}

/** The last-4s this user has registered as credit cards. */
export async function creditCardLast4s(userId: number): Promise<Set<string>> {
  const cards = await prisma.creditCard.findMany({ where: { userId }, select: { last4: true } });
  return new Set(cards.map((c) => c.last4));
}

export async function listCreditCards(userId: number): Promise<CreditCardRow[]> {
  const cards = await prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  const counts = await prisma.transaction.groupBy({
    by: ['accountLast4'],
    where: { userId, isCreditCard: true },
    _count: { _all: true },
  });
  const byLast4 = new Map(counts.map((c) => [c.accountLast4 ?? '', c._count._all]));

  // A transaction flagged by hand ("Charged to a credit card" on the edit
  // panel) or parsed from an alert that never quoted a card number has no
  // accountLast4, so grouping by last-4 dropped it into a bucket no card
  // matched — the card showed "0 transactions" while the charge sat in the
  // month's total. With exactly one card registered the attribution is
  // unambiguous, so fold those in; with several we can't guess, and the page
  // surfaces them as an unassigned row instead.
  const unattributed = byLast4.get('') ?? 0;
  return cards.map((c) => ({
    id: c.id,
    last4: c.last4,
    label: c.label,
    txnCount: (byLast4.get(c.last4) ?? 0) + (cards.length === 1 ? unattributed : 0),
  }));
}

/**
 * Register a card and retro-flag this user's existing card transactions on that
 * last-4. Returns how many past transactions were reclassified.
 */
export async function addCreditCard(userId: number, last4: string, label: string): Promise<number> {
  await prisma.creditCard.upsert({
    where: { userId_last4: { userId, last4 } },
    create: { userId, last4, label },
    update: { label },
  });
  const upd = await prisma.transaction.updateMany({
    where: { userId, accountLast4: last4, instrument: 'card', isCreditCard: false },
    data: { isCreditCard: true },
  });
  return upd.count;
}

/** Unregister a card and clear the flag from its transactions. */
export async function removeCreditCard(userId: number, id: number): Promise<void> {
  const card = await prisma.creditCard.findFirst({ where: { id, userId } });
  if (!card) return;
  await prisma.transaction.updateMany({
    where: { userId, accountLast4: card.last4, isCreditCard: true },
    data: { isCreditCard: false },
  });
  await prisma.creditCard.delete({ where: { id: card.id } });
}
