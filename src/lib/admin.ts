import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './db';
import { currentUserId } from './session-server';

/**
 * Admins are the accounts listed in ADMIN_EMAILS (comma-separated). Kept in
 * the environment rather than the users table so granting admin needs no
 * migration, and so nobody can make themselves admin from inside the app.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

/** The admin's user id, or a 401/403 response. */
export async function requireAdmin(req: NextRequest): Promise<number | NextResponse> {
  const uid = await currentUserId(req);
  if (uid == null) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true } });
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return uid;
}
