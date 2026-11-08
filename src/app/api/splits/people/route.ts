import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/** Names you've split with before, most used first — for the name field's suggestions. */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const rows = await prisma.splitShare.groupBy({
    by: ['name'],
    where: { userId },
    _count: { name: true },
    orderBy: { _count: { name: 'desc' } },
    take: 30,
  });
  return NextResponse.json({ names: rows.map((r) => r.name) });
}
