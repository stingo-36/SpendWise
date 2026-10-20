import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { isAdminEmail, isAdminUser, requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Change an account's email and/or password. Admins only, and works on the
 * admin's own account too: admin rights follow the is_admin flag, not the
 * email, so renaming the admin keeps the console.
 *
 * Note: sessions are signed user ids, so a password change does not sign the
 * user out of devices that are already signed in.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin(req);
  if (adminId instanceof NextResponse) return adminId;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isAdmin: true } });
  if (!target) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { email?: string; passwordHash?: string } = {};

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
    if (email !== target.email) {
      // A reserved admin email would hand admin rights to whoever holds it.
      if (isAdminEmail(email) && !isAdminUser(target)) {
        return NextResponse.json({ error: 'That email is reserved for the admin account' }, { status: 400 });
      }
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) return NextResponse.json({ error: 'Another account already uses this email' }, { status: 409 });
      data.email = email;
    }
  }

  if (body.password !== undefined && body.password !== '') {
    const pw = String(body.password);
    if (pw.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    data.passwordHash = hashPassword(pw);
  }

  if (!data.email && !data.passwordHash) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  // Keep admin rights attached to the account, not to the old email.
  const keepAdmin = isAdminUser(target) && !target.isAdmin ? { isAdmin: true } : {};
  const user = await prisma.user.update({ where: { id }, data: { ...data, ...keepAdmin }, select: { id: true, email: true } });
  return NextResponse.json({ ok: true, user, changed: { email: !!data.email, password: !!data.passwordHash } });
}
