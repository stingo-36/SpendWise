import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyMobileToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { bearer, mobileJson, preflight } from '@/lib/mobileApi';

export const runtime = 'nodejs';

const IST_OFFSET_MS = 330 * 60 * 1000;

/** [start, end) of a YYYY-MM month in IST, as absolute instants. */
function monthBounds(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS), lt: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS) };
}

/**
 * The Pulse app's full transaction list, newest first. Read-only, authenticated
 * by the mobile read token. Query: month=YYYY-MM (omit for all time), page, pageSize (max 100).
 */
export async function GET(req: NextRequest) {
  const userId = await verifyMobileToken(bearer(req));
  if (userId == null) return mobileJson({ error: 'unauthorized' }, 401);

  const sp = req.nextUrl.searchParams;
  const month = sp.get('month');
  if (month && !/^\d{4}-\d{2}$/.test(month)) return mobileJson({ error: 'month must be YYYY-MM' }, 400);
  const page = Math.max(1, Number(sp.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('pageSize') || 50)));

  const where: Prisma.TransactionWhereInput = { userId, ...(month ? { occurredAt: monthBounds(month) } : {}) };
  try {
    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, occurredAt: true, amount: true, direction: true, merchant: true, displayLabel: true,
          instrument: true, isCreditCard: true, category: { select: { name: true } },
        },
      }),
    ]);
    return mobileJson({
      total, page, pageSize,
      items: rows.map((t) => ({
        id: t.id,
        occurredAt: t.occurredAt.toISOString(),
        amount: Math.round(Number(t.amount) * 100) / 100,
        direction: t.direction,
        label: t.displayLabel || t.merchant,
        categoryName: t.category?.name ?? null,
        instrument: t.instrument,
        isCreditCard: t.isCreditCard,
      })),
    });
  } catch {
    return mobileJson({ error: 'Could not load your transactions. Try again shortly.' }, 503);
  }
}

export function OPTIONS() {
  return preflight();
}
