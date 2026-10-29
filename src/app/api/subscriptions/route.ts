import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizedMonthlyTotal, summarizeMerchant, dateOnly, findMatchingMerchant, guessKind, CADENCE_DAYS, type Cadence } from '@/lib/subscriptions';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const [subs, monthly] = await Promise.all([
    prisma.subscription.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { nextExpected: 'asc' }] }),
    normalizedMonthlyTotal(userId),
  ]);
  return NextResponse.json({
    normalizedMonthlyTotal: monthly,
    subscriptions: subs.map((s) => ({
      id: s.id,
      merchant: s.merchant,
      medianAmount: s.medianAmount.toString(),
      intervalDays: s.intervalDays,
      cadence: s.cadence,
      firstSeen: s.firstSeen.toISOString().slice(0, 10),
      lastCharged: s.lastCharged.toISOString().slice(0, 10),
      nextExpected: s.nextExpected.toISOString().slice(0, 10),
      status: s.status,
      kind: s.kind,
    })),
  });
}

/**
 * Track a merchant as a subscription by hand, built from its real charges.
 * Body: { merchant } or { transactionId }, plus optional kind
 * ('subscription' | 'recurring').
 *
 * Or enter one by hand: { name, amount, cadence, date, kind }, where date is
 * the next due date. If a synced payment matches it, that merchant is tracked
 * instead (see findMatchingMerchant) — one entry, not two.
 *
 * This is the counterpart to Re-detect: auto-detection needs three charges at a
 * steady cadence, so anything newer or irregular can only be added this way.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const body = await req.json().catch(() => ({}));
  let merchant: string | null = typeof body.merchant === 'string' ? body.merchant.trim() : null;
  const kind = body.kind === 'subscription' || body.kind === 'recurring' ? (body.kind as string) : null;

  // Hand-entered: name, amount, cadence and next due date.
  let dueDate: Date | null = null;
  if (!merchant && typeof body.name === 'string') {
    const name = body.name.trim();
    const amount = Number(body.amount);
    const cadence: Cadence = body.cadence in CADENCE_DAYS ? body.cadence : 'monthly';
    dueDate = body.date ? new Date(body.date) : null;
    if (!name) return NextResponse.json({ error: 'Give it a name.' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Enter the amount.' }, { status: 400 });
    if (!dueDate || isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Pick the due date.' }, { status: 400 });

    merchant = await findMatchingMerchant(userId, name, amount, dueDate);
    if (!merchant) {
      // Nothing paid yet: track it as entered. Upsert on the name, so adding
      // the same thing twice updates it instead of listing it twice.
      const interval = CADENCE_DAYS[cadence];
      const next = dateOnly(dueDate);
      const last = dateOnly(new Date(next.getTime() - interval * 86_400_000));
      const data = {
        userId,
        merchant: name.toUpperCase(),
        medianAmount: new Prisma.Decimal(amount.toFixed(2)),
        intervalDays: interval,
        cadence,
        firstSeen: last,
        lastCharged: last,
        nextExpected: next,
        status: 'active',
        kind: kind ?? guessKind(name),
      };
      const sub = await prisma.subscription.upsert({
        where: { userId_merchant: { userId, merchant: data.merchant } },
        update: data,
        create: data,
      });
      return NextResponse.json({ ok: true, linked: false, subscription: { id: sub.id, merchant: sub.merchant, cadence: sub.cadence } });
    }
  }

  if (!merchant && Number.isInteger(body.transactionId)) {
    const t = await prisma.transaction.findFirst({ where: { id: body.transactionId, userId }, select: { merchant: true } });
    merchant = t?.merchant ?? null;
  }
  if (!merchant) return NextResponse.json({ error: 'Pick a transaction or merchant to track.' }, { status: 400 });

  const charges = await prisma.transaction.findMany({
    where: { userId, merchant, direction: 'debit' },
    select: { id: true, amount: true, occurredAt: true },
  });
  if (charges.length === 0) return NextResponse.json({ error: `No spending found for ${merchant}.` }, { status: 400 });

  const s = summarizeMerchant(charges.map((c) => ({ amount: Number(c.amount), occurredAt: c.occurredAt })));

  const data = {
    userId,
    merchant,
    medianAmount: new Prisma.Decimal(s.medianAmount.toFixed(2)),
    intervalDays: s.intervalDays,
    cadence: s.cadence,
    firstSeen: dateOnly(s.firstSeen),
    lastCharged: dateOnly(s.lastCharged),
    nextExpected: dateOnly(s.nextExpected),
    // Added deliberately, so it is active even if a past dismissal exists.
    status: 'active',
    ...(kind ? { kind } : {}),
    // A due date the user entered beats the one projected from past charges.
    ...(dueDate && dueDate.getTime() >= Date.now() - 86_400_000 ? { nextExpected: dateOnly(dueDate) } : {}),
  };

  const sub = await prisma.subscription.upsert({
    where: { userId_merchant: { userId, merchant } },
    update: data,
    create: { ...data, kind: kind ?? guessKind(merchant) },
  });

  // Tag the charges, the same way detection does, so the subscription's history
  // and the recurring flag on those rows agree.
  await prisma.transaction.updateMany({
    where: { id: { in: charges.map((c) => c.id) } },
    data: { isRecurring: true, subscriptionId: sub.id },
  });

  return NextResponse.json({ ok: true, linked: dueDate != null, subscription: { id: sub.id, merchant: sub.merchant, cadence: sub.cadence } });
}
