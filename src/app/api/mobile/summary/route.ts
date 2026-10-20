import { NextRequest } from 'next/server';
import { verifyMobileToken } from '@/lib/auth';
import { currentMonth } from '@/lib/reporting';
import { getMobileSummary } from '@/lib/mobileSummary';
import { bearer, mobileJson, preflight } from '@/lib/mobileApi';

export const runtime = 'nodejs';

/** The Pulse app's spending summary. Authenticated by the mobile read token. */
export async function GET(req: NextRequest) {
  const userId = await verifyMobileToken(bearer(req));
  if (userId == null) return mobileJson({ error: 'unauthorized' }, 401);

  const month = req.nextUrl.searchParams.get('month') || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) return mobileJson({ error: 'month must be YYYY-MM' }, 400);

  try {
    return mobileJson(await getMobileSummary(userId, month));
  } catch {
    return mobileJson({ error: 'Could not load your spending. Try again shortly.' }, 503);
  }
}

export function OPTIONS() {
  return preflight();
}
