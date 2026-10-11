import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Restore a deleted transaction: recreate the row from its snapshot and drop
 * the tombstone, so the parse pass stops suppressing it. The source email is
 * put back to 'parsed' — it already produced this transaction.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const tombstoneId = Number(id);
  if (!Number.isInteger(tombstoneId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const row = await prisma.deletedTransaction.findFirst({ where: { id: tombstoneId, userId } });
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const snap = (row.snapshot ?? {}) as Record<string, unknown>;
  const rawEmailId = typeof snap.rawEmailId === 'number' ? snap.rawEmailId : null;

  // The email may have been purged since; only reference it if it still exists.
  const emailExists =
    rawEmailId != null && (await prisma.rawEmail.count({ where: { id: rawEmailId, userId } })) > 0;

  const txn = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId,
        rawEmailId: emailExists ? rawEmailId : null,
        source: (snap.source as string) ?? 'gmail',
        amount: new Prisma.Decimal(row.amount),
        direction: row.direction,
        occurredAt: row.occurredAt,
        rawMerchant: (snap.rawMerchant as string) ?? row.merchant,
        merchant: row.merchant,
        accountLast4: row.accountLast4,
        instrument: (snap.instrument as string) ?? 'unknown',
        referenceId: row.referenceId,
        categoryId: (snap.categoryId as number | null) ?? null,
        subcategoryId: (snap.subcategoryId as number | null) ?? null,
        categoryLocked: Boolean(snap.categoryLocked),
        categorySource: (snap.categorySource as string) ?? 'unassigned',
        displayLabel: (snap.displayLabel as string | null) ?? null,
        llmConfidence: (snap.llmConfidence as number | null) ?? null,
        isRecurring: Boolean(snap.isRecurring),
        isCreditCard: Boolean(snap.isCreditCard),
        notes: (snap.notes as string | null) ?? null,
      },
    });

    if (emailExists) {
      await tx.rawEmail.update({
        where: { id: rawEmailId! },
        data: { parseStatus: 'parsed', parseError: null },
      });
    }

    // Dropping the tombstone is what actually un-suppresses it for future syncs.
    await tx.deletedTransaction.delete({ where: { id: row.id } });
    return created;
  });

  return NextResponse.json({ ok: true, id: txn.id });
}

/** Forget a tombstone without restoring — the transaction may come back on the next sync. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const tombstoneId = Number(id);
  if (!Number.isInteger(tombstoneId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const res = await prisma.deletedTransaction.deleteMany({ where: { id: tombstoneId, userId } });
  if (res.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
