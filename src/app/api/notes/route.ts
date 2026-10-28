import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session-server';
import { NOTE_INCLUDE, cleanTitle, ownTransactionIds, serializeNote } from '@/lib/notes';

export const runtime = 'nodejs';

/** The current user's payment notes, most recently edited first, with their transactions. */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const notes = await prisma.note.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, include: NOTE_INCLUDE });
  return NextResponse.json({ notes: notes.map(serializeNote) });
}

/** Create a note. Body: { title, body?, transactionIds? } */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const body = await req.json().catch(() => ({}));
  const title = cleanTitle(body.title);
  if (typeof title !== 'string') return NextResponse.json(title, { status: 400 });

  const ids = await ownTransactionIds(userId, body.transactionIds);
  const note = await prisma.note.create({
    data: {
      userId,
      title,
      body: String(body.body ?? ''),
      links: { create: ids.map((transactionId) => ({ transactionId })) },
    },
    include: NOTE_INCLUDE,
  });
  return NextResponse.json({ ok: true, note: serializeNote(note) });
}
