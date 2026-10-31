import { NextRequest, NextResponse } from 'next/server';
import { authUrl } from '@/lib/gmail';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

// Kick off the OAuth consent flow for the current user. ?return=onboarding
// sends them back to the setup flow afterwards instead of Settings; it's a
// fixed value, never a URL, so it can't be used as an open redirect.
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  try {
    const res = NextResponse.redirect(await authUrl(userId));
    if (req.nextUrl.searchParams.get('return') === 'onboarding') {
      res.cookies.set('sw_oauth_return', 'onboarding', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
    }
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/settings?gmail_error=${encodeURIComponent(msg)}`, req.url));
  }
}
