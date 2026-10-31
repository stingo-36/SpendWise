import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/gmail';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return NextResponse.redirect(new URL('/login', req.url));

  // Where the flow started (see ../route.ts): back to onboarding, else Settings.
  const page = req.cookies.get('sw_oauth_return')?.value === 'onboarding' ? '/onboarding' : '/settings';
  const back = (query: string) => {
    const res = NextResponse.redirect(new URL(`${page}?${query}`, req.url));
    res.cookies.delete('sw_oauth_return');
    return res;
  };

  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  if (error) return back(`gmail_error=${encodeURIComponent(error)}`);
  if (!code) return back('gmail_error=missing_code');

  try {
    await exchangeCode(code, userId);
    return back('gmail=connected');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return back(`gmail_error=${encodeURIComponent(msg)}`);
  }
}
