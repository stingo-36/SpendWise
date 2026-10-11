import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/** List this user's keyword rules plus the global seed rules. */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const rules = await prisma.merchantRule.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: [{ categoryId: 'asc' }, { priority: 'desc' }],
    include: { category: true, subcategory: true },
  });
  return NextResponse.json({
    rules: rules.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? '',
      subcategoryId: r.subcategoryId,
      subcategoryName: r.subcategory?.name ?? null,
      label: r.label,
      source: r.source,
      global: r.userId == null,
      hitCount: r.hitCount,
    })),
  });
}

/** Create a keyword rule for this user: { keyword, categoryId, subcategoryId? }. */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const body = await req.json().catch(() => ({}));
  const keyword = String(body.keyword ?? '').trim();
  const categoryId = Number(body.categoryId);
  if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 });
  if (!Number.isInteger(categoryId)) return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
  const subcategoryId = body.subcategoryId != null && body.subcategoryId !== '' ? Number(body.subcategoryId) : null;

  const pattern = keyword.toUpperCase();
  const existing = await prisma.merchantRule.findFirst({ where: { userId, pattern } });
  if (existing) {
    await prisma.merchantRule.update({ where: { id: existing.id }, data: { categoryId, subcategoryId, priority: 60 } });
  } else {
    await prisma.merchantRule.create({ data: { userId, pattern, categoryId, subcategoryId, priority: 60, source: 'manual' } });
  }

  // Apply immediately to this user's matching transactions (except locked ones).
  const applied = await prisma.transaction.updateMany({
    where: { userId, merchant: { contains: pattern, mode: 'insensitive' }, categoryLocked: false },
    data: { categoryId, subcategoryId, categorySource: 'rule' },
  });

  return NextResponse.json({ ok: true, applied: applied.count });
}
