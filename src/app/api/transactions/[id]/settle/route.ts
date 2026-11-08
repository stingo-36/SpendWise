import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

async function ownCredit(req: NextRequest, params: Promise<{ id: string }>) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const txnId = Number((await params).id);
  if (!Number.isInteger(txnId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const txn = await prisma.transaction.findFirst({ where: { id: txnId, userId } });
  if (!txn) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (txn.direction !== 'credit') return NextResponse.json({ error: 'Only money you received can pay back a share.' }, { status: 400 });
  return { userId, txn };
}

/**
 * Link an incoming credit to the share it pays back. Body: { shareId }.
 * The credit then stops counting as income. A credit settles one share, and
 * a share is settled by one credit.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const own = await ownCredit(req, params);
  if (own instanceof NextResponse) return own;
  const body = await req.json().catch(() => ({}));
  const shareId = Number(body.shareId);
  if (!Number.isInteger(shareId)) return NextResponse.json({ error: 'shareId is required' }, { status: 400 });

  const share = await prisma.splitShare.findFirst({ where: { id: shareId, userId: own.userId } });
  if (!share) return NextResponse.json({ error: 'That share no longer exists.' }, { status: 404 });
  if (share.settledById != null && share.settledById !== own.txn.id) {
    return NextResponse.json({ error: `${share.name}'s share is already paid back.` }, { status: 409 });
  }

  await prisma.$transaction([
    // A credit settles at most one share: move it if it was on another.
    prisma.splitShare.updateMany({ where: { settledById: own.txn.id, id: { not: share.id } }, data: { settledById: null, settledAt: null } }),
    prisma.splitShare.update({ where: { id: share.id }, data: { settledById: own.txn.id, settledAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true });
}

/** Unlink: the credit counts as income again and the share is open. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const own = await ownCredit(req, params);
  if (own instanceof NextResponse) return own;
  await prisma.splitShare.updateMany({ where: { settledById: own.txn.id }, data: { settledById: null, settledAt: null } });
  return NextResponse.json({ ok: true });
}
