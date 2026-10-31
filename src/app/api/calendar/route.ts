import { NextRequest, NextResponse } from 'next/server';
import { getMonthCalendar } from '@/lib/moneyCalendar';
import { currentMonth } from '@/lib/reporting';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/** GET ?month=YYYY-MM: income, recurring payments and card dates for one month. */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const month = req.nextUrl.searchParams.get('month') || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  return NextResponse.json(await getMonthCalendar(userId, month));
}
