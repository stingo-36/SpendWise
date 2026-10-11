import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/gmail';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return NextResponse.redirect(new URL('/login', req.url));

  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  if (error) return NextResponse.redirect(new URL(`/settings?gmail_error=${encodeURIComponent(error)}`, req.url));
  if (!code) return NextResponse.redirect(new URL('/settings?gmail_error=missing_code', req.url));

  try {
    await exchangeCode(code, userId);
    return NextResponse.redirect(new URL('/settings?gmail=connected', req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/settings?gmail_error=${encodeURIComponent(msg)}`, req.url));
  }
}
