import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminEmail, requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

/** Every account with its activity, for the admin console. Admins only. */
export async function GET(req: NextRequest) {
  const adminId = await requireAdmin(req);
  if (adminId instanceof NextResponse) return adminId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [users, txnStats, monthDebits, recentTxn, gmail, syncs, budgets, cats] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.transaction.groupBy({ by: ['userId'], _count: { _all: true }, _max: { occurredAt: true, createdAt: true } }),
    prisma.transaction.groupBy({ by: ['userId', 'categoryId', 'subcategoryId'], where: { direction: 'debit', occurredAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ['userId'], where: { createdAt: { gte: weekAgo } }, _count: { _all: true } }),
    prisma.gmailToken.findMany({ where: { refreshToken: { not: null } }, select: { userId: true, emailAddress: true } }),
    prisma.syncState.findMany({ select: { userId: true, lastSyncAt: true, lastSyncStatus: true } }),
    prisma.budget.groupBy({ by: ['userId'], _count: { _all: true } }),
    prisma.category.findMany({ select: { id: true, isExpense: true } }),
  ]);

  // Spend the way the dashboard counts it: is_expense debits only, so transfers
  // to your own account and card-bill payments don't inflate the number.
  const isExpense = new Map(cats.map((c) => [c.id, c.isExpense]));
  const spend = new Map<number, number>();
  for (const g of monthDebits) {
    const effId = g.subcategoryId ?? g.categoryId;
    if (effId != null && !(isExpense.get(effId) ?? true)) continue;
    spend.set(g.userId, (spend.get(g.userId) ?? 0) + Number(g._sum.amount ?? 0));
  }

  const by = <T extends { userId: number }>(rows: T[]) => new Map(rows.map((r) => [r.userId, r]));
  const stats = by(txnStats), recent = by(recentTxn), gm = by(gmail), sync = by(syncs), bud = by(budgets);

  const rows = users.map((u) => {
    const st = stats.get(u.id), sy = sync.get(u.id);
    return {
      id: u.id,
      email: u.email,
      isAdmin: isAdminEmail(u.email),
      createdAt: u.createdAt.toISOString(),
      transactions: st?._count._all ?? 0,
      lastTransactionAt: st?._max.occurredAt?.toISOString() ?? null,
      lastActivityAt: [st?._max.createdAt, sy?.lastSyncAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0]?.toISOString() ?? null,
      monthSpend: Math.round((spend.get(u.id) ?? 0) * 100) / 100,
      gmail: gm.get(u.id)?.emailAddress ?? (gm.has(u.id) ? 'connected' : null),
      lastSyncStatus: sy?.lastSyncStatus ?? null,
      budgets: bud.get(u.id)?._count._all ?? 0,
      activeThisWeek: (recent.get(u.id)?._count._all ?? 0) > 0,
    };
  });

  return NextResponse.json({
    totals: {
      users: rows.length,
      newThisMonth: rows.filter((r) => new Date(r.createdAt) >= monthStart).length,
      activeThisWeek: rows.filter((r) => r.activeThisWeek).length,
      transactions: rows.reduce((s, r) => s + r.transactions, 0),
      gmailConnected: rows.filter((r) => r.gmail).length,
    },
    users: rows,
  });
}
