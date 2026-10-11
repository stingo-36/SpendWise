import { NextRequest, NextResponse } from 'next/server';
import { runParsePass } from '@/lib/parsePass';
import { dedupeTransactions } from '@/lib/dedupe';
import { requireUser } from '@/lib/session-server';
import { withSyncLock, SyncBusyError } from '@/lib/syncLock';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  // ?retryUnparsed=1 gives mail that matched no template another go, for after
  // a parser fix — otherwise those emails are stranded (see runParsePass).
  const retryUnparsed = req.nextUrl.searchParams.get('retryUnparsed') === '1';
  try {
    const result = await withSyncLock(userId, async () => {
      const parse = await runParsePass(userId, 500, { retryUnparsed });
      const dedupe = await dedupeTransactions(userId, { sinceDays: 120 });
      return { ...parse, dedupe };
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof SyncBusyError) return NextResponse.json({ ok: true, busy: true, message: err.message });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
