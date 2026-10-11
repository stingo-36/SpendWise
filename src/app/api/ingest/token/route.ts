import { NextRequest, NextResponse } from 'next/server';
import { createIngestToken } from '@/lib/auth';
import { requireUser } from '@/lib/session-server';
import { allSmsSenders } from '@/config/banks';

export const runtime = 'nodejs';

/**
 * The caller's own SMS ingest token, for pasting into the phone automation.
 * Session-authenticated (unlike the ingest endpoint itself, which is what the
 * token is for) — note middleware allows '/api/ingest/sms' through by exact
 * path, so this sibling route is still behind the session gate.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  return NextResponse.json({
    token: await createIngestToken(userId),
    senders: allSmsSenders(),
  });
}
