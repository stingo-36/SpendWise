import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Full data export (spec §13) for the current user. ?format=json | csv.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const format = req.nextUrl.searchParams.get('format') || 'json';

  const txns = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { occurredAt: 'desc' },
    include: { category: true, subcategory: true },
  });

  if (format === 'csv') {
    const header = ['id', 'occurred_at', 'amount', 'direction', 'merchant', 'raw_merchant', 'category', 'subcategory', 'instrument', 'account_last4', 'reference_id', 'source', 'category_source', 'is_recurring', 'notes'];
    const rows = txns.map((t) =>
      [
        t.id,
        t.occurredAt.toISOString(),
        t.amount.toString(),
        t.direction,
        csv(t.merchant),
        csv(t.rawMerchant),
        csv(t.category?.name ?? ''),
        csv(t.subcategory?.name ?? ''),
        t.instrument,
        t.accountLast4 ?? '',
        t.referenceId ?? '',
        t.source,
        t.categorySource,
        t.isRecurring,
        csv(t.notes ?? ''),
      ].join(','),
    );
    const body = [header.join(','), ...rows].join('\n');
    return new NextResponse(body, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="spendwise-export-${today()}.csv"` },
    });
  }

  const [categories, rules, subscriptions] = await Promise.all([
    prisma.category.findMany(),
    prisma.merchantRule.findMany({ where: { OR: [{ userId }, { userId: null }] } }),
    prisma.subscription.findMany({ where: { userId } }),
  ]);

  const payload = { exportedAt: new Date().toISOString(), transactions: txns, categories, merchantRules: rules, subscriptions };
  return new NextResponse(JSON.stringify(payload, replacer, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="spendwise-export-${today()}.json"` },
  });
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
// Serialize Prisma Decimal / BigInt safely.
function replacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  if (value && typeof value === 'object' && 'toFixed' in value && typeof (value as any).toFixed === 'function') {
    return (value as any).toString();
  }
  return value;
}
