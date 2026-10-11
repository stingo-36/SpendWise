import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/**
 * Delete a category (and its subcategories if top-level). References are cleared
 * first: transactions unassigned, rules/budgets removed. Shared taxonomy.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const catId = Number(id);
  if (!Number.isInteger(catId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const cat = await prisma.category.findUnique({ where: { id: catId }, include: { children: true } });
  if (!cat) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const ids = [catId, ...cat.children.map((c) => c.id)];

  // Clear references across all users, then delete.
  await prisma.transaction.updateMany({ where: { categoryId: { in: ids } }, data: { categoryId: null, subcategoryId: null, categorySource: 'unassigned', categoryLocked: false } });
  await prisma.transaction.updateMany({ where: { subcategoryId: { in: ids } }, data: { subcategoryId: null } });
  await prisma.merchantRule.deleteMany({ where: { OR: [{ categoryId: { in: ids } }, { subcategoryId: { in: ids } }] } });
  await prisma.budget.deleteMany({ where: { categoryId: { in: ids } } });
  await prisma.category.deleteMany({ where: { parentId: catId } });
  await prisma.category.delete({ where: { id: catId } });

  return NextResponse.json({ ok: true });
}
