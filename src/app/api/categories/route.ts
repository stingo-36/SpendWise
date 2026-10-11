import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

// Full category tree for the editors.
export async function GET() {
  const cats = await prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }] });
  const tops = cats
    .filter((c) => c.parentId == null)
    .map((top) => ({
      id: top.id,
      name: top.name,
      isExpense: top.isExpense,
      subcategories: cats.filter((s) => s.parentId === top.id).map((s) => ({ id: s.id, name: s.name, isExpense: s.isExpense })),
    }));
  return NextResponse.json({ categories: tops });
}

/**
 * Create a category or subcategory.
 * Body: { name, parentId?, isExpense? } — parentId null = top-level.
 * (Categories are a shared taxonomy across users.)
 */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const parentId = body.parentId != null && body.parentId !== '' ? Number(body.parentId) : null;
  let isExpense = body.isExpense !== false; // default true

  if (parentId != null) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent || parent.parentId != null) return NextResponse.json({ error: 'invalid parent' }, { status: 400 });
    isExpense = parent.isExpense; // subcategory inherits parent
  }

  const dup = await prisma.category.findFirst({ where: { name, parentId } });
  if (dup) return NextResponse.json({ error: 'That category already exists' }, { status: 409 });

  const maxSort = await prisma.category.aggregate({ where: { parentId }, _max: { sortOrder: true } });
  const cat = await prisma.category.create({
    data: { name, parentId, isExpense, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json({ ok: true, id: cat.id });
}
