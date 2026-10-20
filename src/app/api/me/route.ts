import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminUser } from '@/lib/admin';
import { requireUser } from '@/lib/session-server';

export const runtime = 'nodejs';

/** Who is signed in, and whether they get the admin console. */
export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (userId instanceof NextResponse) return userId;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isAdmin: true } });
  return NextResponse.json({ email: user?.email ?? null, isAdmin: isAdminUser(user) });
}
