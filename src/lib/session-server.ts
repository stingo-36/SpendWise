import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './auth';

/** Resolve the current user's id from the request cookie, or null. */
export async function currentUserId(req: NextRequest): Promise<number | null> {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

/**
 * Get the user id or return a 401 response. Usage:
 *   const uid = await requireUser(req); if (uid instanceof NextResponse) return uid;
 */
export async function requireUser(req: NextRequest): Promise<number | NextResponse> {
  const uid = await currentUserId(req);
  if (uid == null) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return uid;
}
