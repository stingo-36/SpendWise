import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';
import { checkSplit } from '@/lib/splits';

export const runtime = 'nodejs';

async function ownDebit(req: NextRequest, params: Promise<{ id: string }>) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const txnId = Number((await params).id);
  if (!Number.isInteger(txnId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const txn = await prisma.transaction.findFirst({ where: { id: txnId, userId } });
  if (!txn) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (txn.direction !== 'debit') return NextResponse.json({ error: 'Only money you paid out can be split.' }, { status: 400 });
  return { userId, txn };
}

/**
 * Split a debit with other people (or change an existing split). Body:
 *   { myShare: number, shares: [{ id?, name, amount }] }
 * The parts must add up to the transaction amount. Shares sent with their id
 * are updated in place, so one that was already paid back stays settled;
 * shares left out are removed (and their pay-back becomes ordinary income).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const own = await ownDebit(req, params);
  if (own instanceof NextResponse) return own;
  const { userId, txn } = own;

  const body = await req.json().catch(() => ({}));
  const check = checkSplit(Number(txn.amount), body.myShare, body.shares);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const existing = await prisma.splitShare.findMany({ where: { transactionId: txn.id }, select: { id: true } });
  const existingIds = new Set(existing.map((s) => s.id));
  const keep = check.shares.filter((s) => s.id != null && existingIds.has(s.id));
  const keepIds = new Set(keep.map((s) => s.id!));
  const add = check.shares.filter((s) => s.id == null || !existingIds.has(s.id));

  await prisma.$transaction([
    prisma.splitShare.deleteMany({ where: { transactionId: txn.id, id: { notIn: [...keepIds] } } }),
    ...keep.map((s) =>
      prisma.splitShare.update({ where: { id: s.id! }, data: { name: s.name, amount: new Prisma.Decimal(s.amount.toFixed(2)) } }),
    ),
    prisma.splitShare.createMany({
      data: add.map((s) => ({ userId, transactionId: txn.id, name: s.name, amount: new Prisma.Decimal(s.amount.toFixed(2)) })),
    }),
    prisma.transaction.update({ where: { id: txn.id }, data: { myShare: new Prisma.Decimal(check.myShare.toFixed(2)) } }),
  ]);
  return NextResponse.json({ ok: true });
}

/** Undo a split: the whole amount is yours again, and any pay-backs unlink. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const own = await ownDebit(req, params);
  if (own instanceof NextResponse) return own;
  await prisma.$transaction([
    prisma.splitShare.deleteMany({ where: { transactionId: own.txn.id } }),
    prisma.transaction.update({ where: { id: own.txn.id }, data: { myShare: null } }),
  ]);
  return NextResponse.json({ ok: true });
}
