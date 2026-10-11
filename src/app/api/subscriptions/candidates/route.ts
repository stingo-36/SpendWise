import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';
import { summarizeMerchant } from '@/lib/subscriptions';

export const runtime = 'nodejs';

/**
 * How much a merchant behaves like a subscription.
 *
 * Ranking by charge count alone puts the corner bakery and food delivery on
 * top — frequent, but never subscriptions. What actually distinguishes one is
 * that the amount barely moves: Netflix bills the same figure every month,
 * lunch does not. So amount stability dominates, cadence breaks ties, and raw
 * frequency contributes almost nothing.
 */
function subscriptionLikeness(amounts: number[], median: number, cadence: string): number {
  if (median <= 0) return 0;
  const spread = amounts.reduce((worst, a) => Math.max(worst, Math.abs(a - median) / median), 0);
  const stability = Math.max(0, 1 - spread); // 1 = every charge identical

  // A lone charge is trivially "stable" — it is its own median — so stability
  // only earns credit once there is a second charge to agree with it, and more
  // charges make that agreement mean more. Without this the list fills with
  // one-off purchases scoring a perfect stability they never demonstrated.
  const confidence = Math.max(0, 1 - 1 / amounts.length);

  const rhythm = cadence === 'monthly' ? 1 : cadence === 'annual' || cadence === 'quarterly' ? 0.8 : 0.25;
  return stability * confidence * 3 + rhythm + Math.min(amounts.length, 6) / 12;
}

/**
 * Merchants the user has actually paid, as subscription candidates.
 *
 * Auto-detection needs three charges at a regular cadence (§9), which misses a
 * subscription you've only paid once or twice, or one whose billing date moves
 * around. This is the manual path: everything you've spent on, newest first,
 * with what we'd fill in for you.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const txns = await prisma.transaction.findMany({
    where: { userId, direction: 'debit' },
    orderBy: { occurredAt: 'desc' },
    select: { id: true, merchant: true, displayLabel: true, amount: true, occurredAt: true },
  });

  const tracked = new Set((await prisma.subscription.findMany({ where: { userId }, select: { merchant: true } })).map((s) => s.merchant));

  const byMerchant = new Map<string, typeof txns>();
  for (const t of txns) {
    if (!t.merchant) continue;
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const candidates = Array.from(byMerchant.entries())
    .map(([merchant, list]) => {
      const amounts = list.map((t) => Number(t.amount));
      const s = summarizeMerchant(list.map((t) => ({ amount: Number(t.amount), occurredAt: t.occurredAt })));
      return {
        merchant,
        label: list.find((t) => t.displayLabel)?.displayLabel ?? merchant,
        charges: list.length,
        amount: s.medianAmount.toFixed(2),
        lastCharged: s.lastCharged.toISOString().slice(0, 10),
        cadence: s.cadence,
        intervalDays: s.intervalDays,
        tracked: tracked.has(merchant),
        score: subscriptionLikeness(amounts, s.medianAmount, s.cadence),
      };
    })
    .sort((a, b) => b.score - a.score || b.lastCharged.localeCompare(a.lastCharged));

  return NextResponse.json({ candidates });
}
