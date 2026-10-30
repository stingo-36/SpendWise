/**
 * Credit card bill payments. Paying the bill moves money out of the bank
 * account to clear charges that were already counted as spend when they hit
 * the card, so the payment lives under "Transfers › Credit card bill"
 * (is_expense = false): it reduces the account balance but is never spend.
 */
import { prisma } from './db';

export const CARD_BILL_SUBCATEGORY = 'Credit card bill';

/**
 * The Transfers › Credit card bill ids, creating the subcategory on first use
 * so databases seeded before it existed pick it up without a re-seed.
 */
export async function ensureCardBillCategory(): Promise<{ categoryId: number; subcategoryId: number } | null> {
  const root = await prisma.category.findFirst({ where: { name: 'Transfers', parentId: null }, select: { id: true } });
  if (!root) return null;
  const sub = await prisma.category.upsert({
    where: { name_parentId: { name: CARD_BILL_SUBCATEGORY, parentId: root.id } },
    update: {},
    create: { name: CARD_BILL_SUBCATEGORY, parentId: root.id, isExpense: false, sortOrder: 99 },
    select: { id: true },
  });
  return { categoryId: root.id, subcategoryId: sub.id };
}

/** Read-only lookup — reporting shouldn't create categories as a side effect. */
export async function cardBillSubcategoryId(): Promise<number | null> {
  const sub = await prisma.category.findFirst({
    where: { name: CARD_BILL_SUBCATEGORY, parent: { name: 'Transfers', parentId: null } },
    select: { id: true },
  });
  return sub?.id ?? null;
}
