import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';
import { getBudgetProgress, currentMonth } from '@/lib/reporting';

export const runtime = 'nodejs';

/** GET: this user's budgets with spent-vs-cap for ?month=YYYY-MM (default current). */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const month = req.nextUrl.searchParams.get('month') || currentMonth();
  const budgets = await getBudgetProgress(userId, month);
  return NextResponse.json({ month, budgets });
}

/** POST: create/update a budget { categoryId, amount }. amount<=0 removes it. */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const body = await req.json().catch(() => ({}));
  const categoryId = Number(body.categoryId);
  const amount = Number(body.amount);
  if (!Number.isInteger(categoryId)) return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
  if (!Number.isFinite(amount)) return NextResponse.json({ error: 'amount required' }, { status: 400 });

  if (amount <= 0) {
    await prisma.budget.deleteMany({ where: { userId, categoryId, period: 'monthly' } });
    return NextResponse.json({ ok: true, removed: true });
  }

  await prisma.budget.upsert({
    where: { userId_categoryId_period: { userId, categoryId, period: 'monthly' } },
    update: { amount: new Prisma.Decimal(amount.toFixed(2)) },
    create: { userId, categoryId, period: 'monthly', amount: new Prisma.Decimal(amount.toFixed(2)) },
  });
  return NextResponse.json({ ok: true });
}
