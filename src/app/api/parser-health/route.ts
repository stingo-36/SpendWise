import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Parser-health view data (spec §10 view 5 / §5.2): unparsed raw emails with
 * sample bodies so new bank templates get noticed rather than silently dropped.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const [byStatus, unparsed, bySender] = await Promise.all([
    prisma.rawEmail.groupBy({ by: ['parseStatus'], where: { userId }, _count: true }),
    prisma.rawEmail.findMany({
      where: { userId, parseStatus: 'unparsed' },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      select: { id: true, sender: true, subject: true, bodyText: true, receivedAt: true, parseError: true },
    }),
    prisma.rawEmail.groupBy({ by: ['sender'], where: { userId, parseStatus: 'unparsed' }, _count: true }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row.parseStatus] = row._count;

  return NextResponse.json({
    statusCounts,
    unparsedBySender: bySender.map((s) => ({ sender: s.sender, count: s._count })),
    samples: unparsed.map((u) => ({
      id: u.id,
      sender: u.sender,
      subject: u.subject,
      receivedAt: u.receivedAt.toISOString(),
      parseError: u.parseError,
      bodyPreview: (u.bodyText || '').slice(0, 600),
    })),
  });
}
