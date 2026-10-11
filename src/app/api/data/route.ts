import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Complete delete of the CURRENT user's data (spec §13). Requires ?confirm=DELETE.
 * The user's keyword rules are kept unless ?includeRules=1; Gmail token kept
 * unless ?includeToken=1. Global seed rules are never touched.
 */
export async function DELETE(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  if (req.nextUrl.searchParams.get('confirm') !== 'DELETE') {
    return NextResponse.json({ error: 'add ?confirm=DELETE' }, { status: 400 });
  }
  const includeRules = req.nextUrl.searchParams.get('includeRules') === '1';
  const includeToken = req.nextUrl.searchParams.get('includeToken') === '1';

  // FK order: transactions reference subscriptions & raw_emails.
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.subscription.deleteMany({ where: { userId } });
  await prisma.rawEmail.deleteMany({ where: { userId } });
  // A full reset means a clean slate: keeping tombstones would permanently
  // suppress those transactions from the re-sync that follows.
  await prisma.deletedTransaction.deleteMany({ where: { userId } });
  await prisma.syncState.updateMany({ where: { userId }, data: { lastHistoryId: null, lastSyncAt: null, lastSyncStatus: null } });
  if (includeRules) await prisma.merchantRule.deleteMany({ where: { userId } });
  if (includeToken) await prisma.gmailToken.deleteMany({ where: { userId } });

  return NextResponse.json({ ok: true, includeRules, includeToken });
}
