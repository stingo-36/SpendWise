import { NextRequest, NextResponse } from 'next/server';
import { syncGmail, GmailAuthError, type SyncResult } from '@/lib/gmail';
import { runParsePass } from '@/lib/parsePass';
import { runCategorizer } from '@/lib/categorize';
import { dedupeTransactions } from '@/lib/dedupe';
import { requireUser } from '@/lib/session-server';
import { withSyncLock, SyncBusyError } from '@/lib/syncLock';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Stop starting Gmail downloads after this long into a request. */
const FETCH_BUDGET_MS = 30_000;
/** Stop parsing after this long. */
const PARSE_BUDGET_MS = 40_000;
/** Only dedupe + categorize if at least this much of the 60s is left. */
const FINISH_BEFORE_MS = 25_000;
const PARSE_BATCH = 300;

/**
 * Full ingestion pipeline for the current user: fetch → parse → dedupe →
 * categorize. Serialized per user: the button, AutoSync and the cron all land
 * here, and two overlapping runs used to insert every transaction twice.
 *
 * Body: { month?: "YYYY-MM" } — only fetch that month's mail; otherwise the
 * last BACKFILL_DAYS days.
 *
 * One call does as much as fits safely inside the 60s function limit and
 * answers `more: true` if it stopped early. The client calls again until
 * `more` is false; every stage resumes from what's already stored, so a
 * first sync of a busy inbox finishes over several calls instead of timing
 * out on the first.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const body = await req.json().catch(() => ({}));
  const month = typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month) ? body.month : undefined;
  const start = Date.now();

  try {
    return await withSyncLock(userId, async () => {
      // A dead Gmail token must not strand the local cleanup: there is nothing
      // new to fetch, but the stages below still have work to do.
      let sync: SyncResult | null = null;
      let gmailError: string | null = null;
      try {
        sync = await syncGmail(userId, { month, deadline: start + FETCH_BUDGET_MS });
      } catch (err) {
        if (!(err instanceof GmailAuthError)) throw err;
        gmailError = err.message;
      }
      if (sync && !sync.done) {
        return NextResponse.json({ ok: true, more: true, sync, parse: null, dedupe: null, categorize: null });
      }

      const parse = await runParsePass(userId, PARSE_BATCH, { deadline: start + PARSE_BUDGET_MS });
      const parseLeft = parse.processed === PARSE_BATCH || Date.now() >= start + PARSE_BUDGET_MS;
      if (parseLeft || Date.now() - start > maxDuration * 1000 - FINISH_BEFORE_MS) {
        return NextResponse.json({ ok: !gmailError, error: gmailError, more: true, sync, parse, dedupe: null, categorize: null });
      }

      // Self-heal: clears duplicates left by pipelines that raced before the
      // lock existed. Windowed, because the whole history is scanned otherwise.
      const dedupe = await dedupeTransactions(userId, { sinceDays: 120 });
      const categorize = await runCategorizer(userId, 300);

      return NextResponse.json({ ok: !gmailError, error: gmailError, more: false, sync, parse, dedupe, categorize });
    });
  } catch (err) {
    // A concurrent sync is not a failure — the other run is doing the work.
    if (err instanceof SyncBusyError) return NextResponse.json({ ok: true, busy: true, message: err.message });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
