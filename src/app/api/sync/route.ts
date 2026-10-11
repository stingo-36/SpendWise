import { NextRequest, NextResponse } from 'next/server';
import { syncGmail, GmailAuthError } from '@/lib/gmail';
import { runParsePass } from '@/lib/parsePass';
import { runCategorizer } from '@/lib/categorize';
import { dedupeTransactions } from '@/lib/dedupe';
import { requireUser } from '@/lib/session-server';
import { withSyncLock, SyncBusyError } from '@/lib/syncLock';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Full ingestion pipeline for the current user: fetch → parse → dedupe →
 * categorize. Serialized per user: the button, AutoSync and the cron all land
 * here, and two overlapping runs used to insert every transaction twice.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  try {
    return await withSyncLock(userId, async () => {
      // A dead Gmail token must not strand the local cleanup: there is nothing
      // new to fetch, but the stages below still have work to do.
      let sync: unknown = null;
      let gmailError: string | null = null;
      try {
        sync = await syncGmail(userId);
      } catch (err) {
        if (!(err instanceof GmailAuthError)) throw err;
        gmailError = err.message;
      }

      const parse = await runParsePass(userId);
      // Self-heal: clears duplicates left by pipelines that raced before the
      // lock existed. Windowed, because the whole history is scanned otherwise.
      const dedupe = await dedupeTransactions(userId, { sinceDays: 120 });
      const categorize = await runCategorizer(userId);

      return NextResponse.json({ ok: !gmailError, error: gmailError, sync, parse, dedupe, categorize });
    });
  } catch (err) {
    // A concurrent sync is not a failure — the other run is doing the work.
    if (err instanceof SyncBusyError) return NextResponse.json({ ok: true, busy: true, message: err.message });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
