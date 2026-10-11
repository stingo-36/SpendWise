import { NextRequest, NextResponse } from 'next/server';
import { runCategorizer } from '@/lib/categorize';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  try {
    const result = await runCategorizer(userId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
