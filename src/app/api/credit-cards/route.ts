import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/session-server';
import { addCreditCard, listCreditCards, removeCreditCard } from '@/lib/creditCards';

export const runtime = 'nodejs';

/** GET: this user's registered credit cards. */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  return NextResponse.json({ cards: await listCreditCards(userId) });
}

/** POST { last4, label }: register a card and retro-flag its past transactions. */
export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const body = await req.json().catch(() => ({}));
  const last4 = String(body.last4 ?? '').trim();
  if (!/^\d{4}$/.test(last4)) return NextResponse.json({ error: 'Enter the last 4 digits of the card' }, { status: 400 });
  const label = String(body.label ?? '').trim() || `Card ••${last4}`;
  const reclassified = await addCreditCard(userId, last4, label);
  return NextResponse.json({ ok: true, reclassified });
}

/** DELETE ?id=: unregister a card and clear the flag from its transactions. */
export async function DELETE(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  await removeCreditCard(userId, id);
  return NextResponse.json({ ok: true });
}
