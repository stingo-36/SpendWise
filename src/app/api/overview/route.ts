import { NextRequest, NextResponse } from 'next/server';
import { getMonthlyOverview, getWeeklyCategorySpend, currentMonth } from '@/lib/reporting';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const month = req.nextUrl.searchParams.get('month') || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  const [overview, weekly] = await Promise.all([getMonthlyOverview(userId, month), getWeeklyCategorySpend(userId, month)]);
  return NextResponse.json({ ...overview, weekly });
}
