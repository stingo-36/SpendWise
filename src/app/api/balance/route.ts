import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';
import { getMonthBalance } from '@/lib/balance';

export const runtime = 'nodejs';

/**
 * Set or clear a month's opening balance. Body: { month: "YYYY-MM", opening: number | null }.
 * null removes your amount, so the month carries last month's balance forward again.
 * Returns the month's balance afterwards.
 */
export async function PUT(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const body = await req.json().catch(() => ({}));
  const month = String(body.month ?? '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });

  if (body.opening == null || body.opening === '') {
    await prisma.monthBalance.deleteMany({ where: { userId, month } });
  } else {
    const opening = Number(body.opening);
    if (!Number.isFinite(opening) || Math.abs(opening) >= 1e10) {
      return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
    }
    const value = new Prisma.Decimal(opening.toFixed(2));
    await prisma.monthBalance.upsert({
      where: { userId_month: { userId, month } },
      create: { userId, month, opening: value },
      update: { opening: value },
    });
  }
  return NextResponse.json(await getMonthBalance(userId, month));
}
