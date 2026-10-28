import { Prisma } from '@prisma/client';
import { prisma } from './db';

/** What the Notes page needs of each attached transaction. */
export const NOTE_INCLUDE = {
  links: {
    orderBy: { transaction: { occurredAt: 'desc' } },
    include: { transaction: { include: { category: true, subcategory: true } } },
  },
} satisfies Prisma.NoteInclude;

type NoteWithLinks = Prisma.NoteGetPayload<{ include: typeof NOTE_INCLUDE }>;

export function serializeNote(n: NoteWithLinks) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    transactions: n.links.map(({ transaction: t }) => ({
      id: t.id,
      occurredAt: t.occurredAt.toISOString(),
      amount: t.amount.toString(),
      direction: t.direction,
      label: t.displayLabel || t.merchant,
      categoryName: t.category?.name ?? null,
      subcategoryName: t.subcategory?.name ?? null,
    })),
  };
}

/**
 * The ids from `raw` that are this user's transactions, deduped. Anything
 * else is silently dropped, so a note can never point at someone else's row.
 */
export async function ownTransactionIds(userId: number, raw: unknown): Promise<number[]> {
  if (!Array.isArray(raw)) return [];
  const ids = [...new Set(raw.map(Number).filter(Number.isInteger))];
  if (ids.length === 0) return [];
  const rows = await prisma.transaction.findMany({ where: { userId, id: { in: ids } }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Trimmed title (required, ≤120 chars) or an error message. */
export function cleanTitle(raw: unknown): string | { error: string } {
  const title = String(raw ?? '').trim();
  if (!title) return { error: 'Give the note a title' };
  if (title.length > 120) return { error: 'Keep the title under 120 characters' };
  return title;
}
