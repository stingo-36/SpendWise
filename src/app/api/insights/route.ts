import { NextRequest, NextResponse } from 'next/server';
import { getInsights } from '@/lib/insights';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/** GET ?months=6|12|24: the long view for the Insights page. */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const months = Number(req.nextUrl.searchParams.get('months') ?? 12);
  if (![6, 12, 24].includes(months)) return NextResponse.json({ error: 'months must be 6, 12 or 24' }, { status: 400 });
  return NextResponse.json(await getInsights(userId, months));
}
