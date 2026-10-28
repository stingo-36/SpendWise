import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './auth';
import { prisma } from './db';

/**
 * The id if that account still exists, else null. Sessions and app tokens are
 * signed user ids with no server-side record, so after an admin deletes an
 * account its old cookie and tokens still verify — this is what turns them
 * away instead of letting them write rows for a user that is gone.
 */
export async function liveUserId(id: number | null): Promise<number | null> {
  if (id == null) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return user ? id : null;
}

/** Resolve the current user's id from the request cookie, or null. */
export async function currentUserId(req: NextRequest): Promise<number | null> {
  return liveUserId(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
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
