import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { createMobileToken } from '@/lib/auth';
import { mobileJson, preflight } from '@/lib/mobileApi';

export const runtime = 'nodejs';

/**
 * Link the Pulse mobile app to a SpendWise account.
 *
 * Takes the SpendWise email and password once and returns a read-only mobile
 * token; the app stores the token, never the password. Unlike /api/login this
 * sets no session cookie, so the phone gets summary access and nothing more.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  const pw = String(password ?? '');

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  } catch {
    return mobileJson({ error: 'SpendWise is unavailable right now. Try again shortly.' }, 503);
  }
  if (!user || !verifyPassword(pw, user.passwordHash)) {
    return mobileJson({ error: 'Invalid email or password' }, 401);
  }

  return mobileJson({ token: await createMobileToken(user.id), email: user.email });
}

export function OPTIONS() {
  return preflight();
}
