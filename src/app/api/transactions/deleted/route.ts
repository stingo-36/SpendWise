import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Transactions the user has deleted (spec §7 — deletions are tombstoned rather
 * than forgotten, so a re-sync can't resurrect them). Newest first.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 500);

  const rows = await prisma.deletedTransaction.findMany({
    where: { userId },
    orderBy: { deletedAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    items: rows.map((r) => {
      const snap = (r.snapshot ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        amount: r.amount.toString(),
        direction: r.direction,
        occurredAt: r.occurredAt.toISOString(),
        merchant: r.merchant,
        accountLast4: r.accountLast4,
        deletedAt: r.deletedAt.toISOString(),
        label: (snap.displayLabel as string | null) ?? r.merchant,
        instrument: (snap.instrument as string | undefined) ?? 'unknown',
      };
    }),
  });
}
