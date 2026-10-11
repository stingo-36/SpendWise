import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Manually add a transaction (income or expense). Body:
 *   { direction: 'credit'|'debit', amount, occurredAt (ISO date), description,
 *     categoryId?, subcategoryId?, notes? }
 * Stored as source='manual' and locked so the categorizer never overwrites it.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const body = await req.json().catch(() => ({}));
  const direction = body.direction === 'credit' ? 'credit' : 'debit';
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });

  const description = String(body.description ?? '').trim() || (direction === 'credit' ? 'Income' : 'Expense');
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  if (isNaN(occurredAt.getTime())) return NextResponse.json({ error: 'invalid date' }, { status: 400 });

  const categoryId = body.categoryId != null && body.categoryId !== '' ? Number(body.categoryId) : null;
  const subcategoryId = body.subcategoryId != null && body.subcategoryId !== '' ? Number(body.subcategoryId) : null;

  const txn = await prisma.transaction.create({
    data: {
      userId,
      source: 'manual',
      amount: new Prisma.Decimal(amount.toFixed(2)),
      direction,
      occurredAt,
      rawMerchant: description,
      merchant: description.toUpperCase(),
      displayLabel: description,
      instrument: 'unknown',
      categoryId,
      subcategoryId,
      categoryLocked: true,
      categorySource: categoryId ? 'manual' : 'unassigned',
      notes: body.notes ? String(body.notes) : null,
    },
  });
  return NextResponse.json({ ok: true, id: txn.id });
}

/**
 * Filterable transaction list (spec §10 view 2). Query params:
 *   from, to (ISO date), categoryId, merchant (contains), direction,
 *   minAmount, maxAmount, reviewQueue=1 (uncategorized/low-confidence),
 *   page, pageSize.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const sp = req.nextUrl.searchParams;
  const where: Prisma.TransactionWhereInput = { userId };

  const from = sp.get('from');
  const to = sp.get('to');
  if (from || to) {
    where.occurredAt = {};
    if (from) (where.occurredAt as any).gte = new Date(from);
    if (to) (where.occurredAt as any).lte = new Date(to + 'T23:59:59');
  }

  const categoryId = sp.get('categoryId');
  if (categoryId) where.categoryId = Number(categoryId);

  const merchant = sp.get('merchant');
  if (merchant) where.merchant = { contains: merchant, mode: 'insensitive' };

  const direction = sp.get('direction');
  if (direction === 'debit' || direction === 'credit') where.direction = direction;

  const minAmount = sp.get('minAmount');
  const maxAmount = sp.get('maxAmount');
  if (minAmount || maxAmount) {
    where.amount = {};
    if (minAmount) (where.amount as any).gte = new Prisma.Decimal(minAmount);
    if (maxAmount) (where.amount as any).lte = new Prisma.Decimal(maxAmount);
  }

  // creditCard=1 → only card charges; =0 → only account money.
  const creditCard = sp.get('creditCard');
  if (creditCard === '1') where.isCreditCard = true;
  else if (creditCard === '0') where.isCreditCard = false;

  if (sp.get('reviewQueue') === '1') {
    where.categoryId = null;
    where.categoryLocked = false;
  }

  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(200, Math.max(1, Number(sp.get('pageSize') || 50)));

  const [total, items] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: sp.get('reviewQueue') === '1' ? { occurredAt: 'desc' } : { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true, subcategory: true },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    items: items.map((t) => ({
      id: t.id,
      occurredAt: t.occurredAt.toISOString(),
      amount: t.amount.toString(),
      direction: t.direction,
      merchant: t.merchant,
      label: t.displayLabel || t.merchant,
      rawMerchant: t.rawMerchant,
      instrument: t.instrument,
      accountLast4: t.accountLast4,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? null,
      subcategoryId: t.subcategoryId,
      subcategoryName: t.subcategory?.name ?? null,
      categorySource: t.categorySource,
      categoryLocked: t.categoryLocked,
      llmConfidence: t.llmConfidence,
      isRecurring: t.isRecurring,
      isCreditCard: t.isCreditCard,
      notes: t.notes,
    })),
  });
}
