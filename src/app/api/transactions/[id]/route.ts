import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeBackRule } from '@/lib/categorize';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Edit a transaction's category (spec §7.5 — two correction modes) or notes.
 *
 * Body:
 *   { mode: 'always', categoryId, subcategoryId?, reapply?: boolean }
 *     → writes a merchant_rule (manual, permanent), sets this txn, and optionally
 *       re-applies to all past transactions with the same merchant.
 *   { mode: 'once', categoryId, subcategoryId? }
 *     → sets category on this txn only and locks it (category_locked = true), so
 *       the categorizer never overwrites the one-off.
 *   { notes: string }  → update notes.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const txn = await prisma.transaction.findFirst({ where: { id: txnId, userId } });
  if (!txn) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Credit-card flag toggle (no category involved).
  if (typeof body.isCreditCard === 'boolean' && body.mode == null && body.categoryId == null) {
    await prisma.transaction.update({ where: { id: txnId }, data: { isCreditCard: body.isCreditCard } });
    return NextResponse.json({ ok: true, isCreditCard: body.isCreditCard });
  }

  // Notes-only update.
  if (typeof body.notes === 'string' && body.mode == null && body.categoryId == null) {
    await prisma.transaction.update({ where: { id: txnId }, data: { notes: body.notes } });
    return NextResponse.json({ ok: true });
  }

  const categoryId = Number(body.categoryId);
  if (!Number.isInteger(categoryId)) return NextResponse.json({ error: 'categoryId required' }, { status: 400 });
  const subcategoryId = body.subcategoryId != null ? Number(body.subcategoryId) : null;
  const mode = body.mode === 'once' ? 'once' : 'always';

  if (mode === 'once') {
    // One-off: set + lock so the categorizer skips it (§7.5).
    await prisma.transaction.update({
      where: { id: txnId },
      data: { categoryId, subcategoryId, categoryLocked: true, categorySource: 'manual' },
    });
    return NextResponse.json({ ok: true, mode: 'once' });
  }

  // Always: write a permanent rule + set this txn.
  await writeBackRule(userId, txn.merchant, categoryId, subcategoryId, 'manual');
  await prisma.transaction.update({
    where: { id: txnId },
    data: { categoryId, subcategoryId, categorySource: 'manual' },
  });

  let reapplied = 0;
  if (body.reapply) {
    // Re-apply to this user's past transactions with the same merchant, except locked.
    const upd = await prisma.transaction.updateMany({
      where: { userId, merchant: txn.merchant, categoryLocked: false, id: { not: txnId } },
      data: { categoryId, subcategoryId, categorySource: 'rule' },
    });
    reapplied = upd.count;
  }

  return NextResponse.json({ ok: true, mode: 'always', reapplied });
}

/** Delete a transaction. Manual entries and mis-parsed rows can be removed. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const txn = await prisma.transaction.findFirst({ where: { id: txnId, userId } });
  if (!txn) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await prisma.$transaction([
    // Re-parsing the source email would recreate the row, so mark it consumed.
    ...(txn.rawEmailId != null
      ? [
          prisma.rawEmail.update({
            where: { id: txn.rawEmailId },
            data: { parseStatus: 'ignored', parseError: 'deleted by user' },
          }),
        ]
      : []),
    // A tombstone as well: one purchase often arrives as several alerts, so
    // ignoring just this email still leaves a sibling that would recreate the
    // row on the next parse pass (see lib/parsePass.ts → wasDeleted).
    prisma.deletedTransaction.create({
      data: {
        userId,
        amount: txn.amount,
        direction: txn.direction,
        occurredAt: txn.occurredAt,
        accountLast4: txn.accountLast4,
        merchant: txn.merchant,
        referenceId: txn.referenceId,
        // Snapshot so a restore puts back exactly what was removed.
        snapshot: {
          rawEmailId: txn.rawEmailId,
          source: txn.source,
          amount: txn.amount.toString(),
          direction: txn.direction,
          occurredAt: txn.occurredAt.toISOString(),
          rawMerchant: txn.rawMerchant,
          merchant: txn.merchant,
          accountLast4: txn.accountLast4,
          instrument: txn.instrument,
          referenceId: txn.referenceId,
          categoryId: txn.categoryId,
          subcategoryId: txn.subcategoryId,
          categoryLocked: txn.categoryLocked,
          categorySource: txn.categorySource,
          displayLabel: txn.displayLabel,
          llmConfidence: txn.llmConfidence,
          isRecurring: txn.isRecurring,
          isCreditCard: txn.isCreditCard,
          notes: txn.notes,
        },
      },
    }),
    prisma.transaction.delete({ where: { id: txn.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
