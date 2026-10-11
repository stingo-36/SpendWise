import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncGmail } from '@/lib/gmail';
import { runParsePass } from '@/lib/parsePass';
import { runCategorizer } from '@/lib/categorize';
import { detectSubscriptions } from '@/lib/subscriptions';
import { dedupeTransactions } from '@/lib/dedupe';
import { withSyncLock, SyncBusyError } from '@/lib/syncLock';

export const runtime = 'nodejs';
// 60s is the Hobby-plan ceiling. Incremental syncs finish well within this;
// run the first large backfill locally (npm run sync) against the prod DB.
export const maxDuration = 60;

/**
 * Scheduled run (Vercel Cron) for ALL users. Protected by CRON_SECRET:
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`. Also accepts ?secret=.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const q = req.nextUrl.searchParams.get('secret');
    if (auth !== `Bearer ${secret}` && q !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  const results: Record<number, unknown> = {};

  for (const { id: userId } of users) {
    try {
      // Skip anyone whose pipeline is already running (app-triggered sync).
      results[userId] = await withSyncLock(userId, async () => {
        const sync = await syncGmail(userId).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
        const parse = await runParsePass(userId);
        const dedupe = await dedupeTransactions(userId);
        const categorize = await runCategorizer(userId);
        const subscriptions = await detectSubscriptions(userId);
        return { sync, parse, dedupe, categorize, subscriptions };
      });
    } catch (err) {
      if (err instanceof SyncBusyError) results[userId] = { skipped: 'sync already running' };
      else results[userId] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, users: users.length, results });
}
