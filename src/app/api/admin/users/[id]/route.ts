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

/**
 * Delete an account and everything it owns: transactions, tombstones, raw
 * emails, subscriptions, budgets, credit cards, its own merchant rules, sync
 * state and Gmail token. Shared data (categories, seed rules, app settings) is
 * untouched. Requires ?confirm=<the account's email> so a stray request can't
 * wipe the wrong user.
 *
 * Admin accounts can't be deleted here — that's how the console stays
 * reachable. Revoke admin first (is_admin / ADMIN_EMAILS) if one must go.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin(req);
  if (adminId instanceof NextResponse) return adminId;

  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isAdmin: true } });
  if (!target) return NextResponse.json({ error: 'Unknown user' }, { status: 404 });

  if (id === adminId || isAdminUser(target)) {
    return NextResponse.json({ error: 'Admin accounts can’t be deleted' }, { status: 400 });
  }
  if (req.nextUrl.searchParams.get('confirm')?.trim().toLowerCase() !== target.email) {
    return NextResponse.json({ error: 'Confirm with the account’s email' }, { status: 400 });
  }

  // One transaction so a failure part-way never leaves a half-deleted account.
  // FK order: transactions reference subscriptions & raw_emails.
  const userId = id;
  const [transactions, deletedTransactions, subscriptions, rawEmails, budgets, creditCards, rules] = await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.deletedTransaction.deleteMany({ where: { userId } }),
    prisma.subscription.deleteMany({ where: { userId } }),
    prisma.rawEmail.deleteMany({ where: { userId } }),
    prisma.budget.deleteMany({ where: { userId } }),
    prisma.creditCard.deleteMany({ where: { userId } }),
    // userId null = global seed rule; only this user's own rules go.
    prisma.merchantRule.deleteMany({ where: { userId } }),
    prisma.syncState.deleteMany({ where: { userId } }),
    prisma.gmailToken.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({
    ok: true,
    email: target.email,
    removed: {
      transactions: transactions.count,
      deletedTransactions: deletedTransactions.count,
      subscriptions: subscriptions.count,
      rawEmails: rawEmails.count,
      budgets: budgets.count,
      creditCards: creditCards.count,
      rules: rules.count,
    },
  });
}
