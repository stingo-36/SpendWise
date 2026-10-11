import { NextRequest, NextResponse } from 'next/server';
import { dedupeTransactions } from '@/lib/dedupe';
import { requireUser } from '@/lib/session-server';
import { withSyncLock, SyncBusyError } from '@/lib/syncLock';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Sweep duplicate transactions on demand, over all history. Sync does this
 * automatically over a rolling window; this is the button for cleaning up
 * older damage without waiting for the nightly cron — and it needs no Gmail
 * connection, so it still works while the token is expired.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  try {
    const result = await withSyncLock(userId, () => dedupeTransactions(userId, { sinceDays: null }));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof SyncBusyError) return NextResponse.json({ ok: true, busy: true, message: err.message });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
