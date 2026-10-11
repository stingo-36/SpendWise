import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isConnected } from '@/lib/gmail';
import { llmConfigured } from '@/lib/llm';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const [gmail, rawTotal, pending, unparsed, txns, reviewQueue, sync, llm, user] = await Promise.all([
    isConnected(userId).catch(() => ({ connected: false, email: null })),
    prisma.rawEmail.count({ where: { userId } }),
    prisma.rawEmail.count({ where: { userId, parseStatus: 'pending' } }),
    prisma.rawEmail.count({ where: { userId, parseStatus: 'unparsed' } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId, categoryId: null, categoryLocked: false } }),
    prisma.syncState.findUnique({ where: { userId } }),
    llmConfigured(),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  return NextResponse.json({
    user: { email: user?.email ?? null },
    gmail,
    llmConfigured: llm,
    counts: { rawEmails: rawTotal, pending, unparsed, transactions: txns, reviewQueue },
    lastSyncAt: sync?.lastSyncAt ?? null,
    lastSyncStatus: sync?.lastSyncStatus ?? null,
  });
}
