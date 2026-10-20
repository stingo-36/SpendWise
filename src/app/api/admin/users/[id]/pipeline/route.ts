import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { PIPELINE_STEPS, PipelineStep, pipelineStatus, runPipelineStep } from '@/lib/pipeline';
import { SyncBusyError } from '@/lib/syncLock';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function target(req: NextRequest, params: Promise<{ id: string }>): Promise<number | NextResponse> {
  const adminId = await requireAdmin(req);
  if (adminId instanceof NextResponse) return adminId;
  const id = Number((await params).id);
  const user = Number.isInteger(id) ? await prisma.user.findUnique({ where: { id }, select: { id: true } }) : null;
  return user ? user.id : NextResponse.json({ error: 'Unknown user' }, { status: 404 });
}

/** An account's pipeline counts (raw emails, pending, review queue, last sync). Admins only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await target(req, params);
  if (userId instanceof NextResponse) return userId;
  return NextResponse.json(await pipelineStatus(userId));
}

/** Run one pipeline step for an account: { step: 'sync' | 'parse' | 'categorize' | 'subscriptions' | 'dedupe' }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await target(req, params);
  if (userId instanceof NextResponse) return userId;
  const { step } = await req.json().catch(() => ({}));
  if (!PIPELINE_STEPS.includes(step)) return NextResponse.json({ error: 'Unknown step' }, { status: 400 });
  try {
    const result = await runPipelineStep(userId, step as PipelineStep);
    return NextResponse.json({ ...result, status: await pipelineStatus(userId) });
  } catch (err) {
    if (err instanceof SyncBusyError) return NextResponse.json({ ok: false, summary: 'A sync is already running for this account. Try again in a minute.' }, { status: 409 });
    return NextResponse.json({ ok: false, summary: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
