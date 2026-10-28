import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';
import { NOTE_INCLUDE, cleanTitle, ownTransactionIds, serializeNote } from '@/lib/notes';

export const runtime = 'nodejs';

async function ownNote(req: NextRequest, params: Promise<{ id: string }>) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const id = Number((await params).id);
  const note = Number.isInteger(id) ? await prisma.note.findFirst({ where: { id, userId }, select: { id: true } }) : null;
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  return { userId, id };
}

/**
 * Edit a note. Body: { title?, body?, transactionIds? }. transactionIds is
 * the full new set of attached transactions, replacing the old one.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const own = await ownNote(req, params);
  if (own instanceof NextResponse) return own;
  const body = await req.json().catch(() => ({}));

  const data: { title?: string; body?: string } = {};
  if (body.title !== undefined) {
    const title = cleanTitle(body.title);
    if (typeof title !== 'string') return NextResponse.json(title, { status: 400 });
    data.title = title;
  }
  if (body.body !== undefined) data.body = String(body.body);

  const ids = body.transactionIds !== undefined ? await ownTransactionIds(own.userId, body.transactionIds) : null;
  const note = await prisma.note.update({
    where: { id: own.id },
    data: {
      ...data,
      // Touch updatedAt even when only the attachments changed, so the note moves to the top.
      updatedAt: new Date(),
      ...(ids && { links: { deleteMany: {}, create: ids.map((transactionId) => ({ transactionId })) } }),
    },
    include: NOTE_INCLUDE,
  });
  return NextResponse.json({ ok: true, note: serializeNote(note) });
}

/** Delete a note. Its transactions are untouched — only the links go. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const own = await ownNote(req, params);
  if (own instanceof NextResponse) return own;
  await prisma.note.delete({ where: { id: own.id } });
  return NextResponse.json({ ok: true });
}
