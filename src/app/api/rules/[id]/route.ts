import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

// Delete a keyword rule — the user's own, or a shared default seed rule.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  // Allow removing this user's rules AND global seed defaults (userId null).
  const res = await prisma.merchantRule.deleteMany({ where: { id: ruleId, OR: [{ userId }, { userId: null }] } });
  return NextResponse.json({ ok: true, deleted: res.count });
}
