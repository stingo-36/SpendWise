import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './db';
import { currentUserId } from './session-server';

/** The built-in admin login. Always an admin, whatever ADMIN_EMAILS says. */
export const DEFAULT_ADMIN_EMAIL = 'admin@spendwise.app';

/**
 * Admins are the built-in admin login plus any accounts listed in
 * ADMIN_EMAILS (comma-separated). Kept out of the users table so granting
 * admin needs no migration, and so nobody can make themselves admin from
 * inside the app — signup refuses every admin email, so the account can only
 * be created with `npm run seed:admin`.
 */
export function adminEmails(): string[] {
  const extra = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [DEFAULT_ADMIN_EMAIL, ...extra];
}

/** A reserved admin email. Signup refuses these, and only an admin can take one. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.trim().toLowerCase());
}

/**
 * Admin = the account's is_admin flag, or a reserved admin email. The flag is
 * what lets the admin change its own email without losing the console.
 */
export function isAdminUser(user: { isAdmin?: boolean | null; email?: string | null } | null | undefined): boolean {
  return !!user && (!!user.isAdmin || isAdminEmail(user.email));
}

/** The admin's user id, or a 401/403 response. */
export async function requireAdmin(req: NextRequest): Promise<number | NextResponse> {
  const uid = await currentUserId(req);
  if (uid == null) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true, isAdmin: true } });
  if (!isAdminUser(user)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return uid;
}
