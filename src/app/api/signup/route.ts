import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { SESSION_COOKIE, createSession } from '@/lib/auth';
import { dbErrorResponse } from '@/lib/db-error';

export const runtime = 'nodejs';

function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  const pw = String(password ?? '');
  if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
  if (pw.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

  let user;
  try {
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });

    user = await prisma.user.create({ data: { email: cleanEmail, passwordHash: hashPassword(pw) } });
  } catch (err) {
    return dbErrorResponse(err);
  }
  // sync_state is created lazily on the user's first sync.

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, await createSession(user.id));
  return res;
}
