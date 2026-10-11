import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

// Dismiss a false-positive subscription, or reactivate one (spec §9).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const subId = Number(id);
  if (!Number.isInteger(subId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const status = body.status;
  if (!['active', 'dismissed'].includes(status)) return NextResponse.json({ error: 'status must be active|dismissed' }, { status: 400 });

  // Scope the update to this user's subscription.
  const result = await prisma.subscription.updateMany({ where: { id: subId, userId }, data: { status } });
  if (result.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
