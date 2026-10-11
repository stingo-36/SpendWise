import { NextRequest, NextResponse } from 'next/server';
import { authUrl } from '@/lib/gmail';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

// Kick off the OAuth consent flow for the current user.
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  try {
    return NextResponse.redirect(await authUrl(userId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/settings?gmail_error=${encodeURIComponent(msg)}`, req.url));
  }
}
