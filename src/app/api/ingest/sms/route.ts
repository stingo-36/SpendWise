import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyIngestToken } from '@/lib/auth';
import { parserForSmsSender } from '@/config/banks';
import { runParsePass } from '@/lib/parsePass';

export const runtime = 'nodejs';

/**
 * SMS ingest webhook (the mobile counterpart to Gmail sync).
 *
 * A web app can never read the SMS inbox — no such API exists on Android or
 * iOS — so the phone does that half: an automation app holding READ_SMS
 * (MacroDroid, Tasker, or a native wrapper) POSTs each bank alert here.
 *
 * Authenticated by a per-user bearer token derived from SESSION_SECRET, NOT
 * by a session cookie: the caller is a background automation with no login.
 *
 * Messages land in raw_emails exactly like a fetched email, which is what
 * makes the rest of the pipeline work unchanged — the same parse pass, the
 * same §5.3 dedupe (so a bank that sends BOTH an email and an SMS for one
 * purchase still yields one transaction), and the same review queue.
 */
const Body = z.object({
  /** DLT header as received, e.g. "VM-HDFCBK". */
  sender: z.string().min(2).max(64),
  /** The SMS text. */
  text: z.string().min(1).max(2000),
  /** When the SMS arrived. Defaults to now; ISO-8601 or epoch millis. */
  receivedAt: z.union([z.string(), z.number()]).optional(),
});

function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function POST(req: NextRequest) {
  const userId = await verifyIngestToken(bearer(req));
  if (userId == null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'expected { sender, text, receivedAt? }' }, { status: 400 });
  }

  const { sender, text } = parsed;

  // Reject unknown senders loudly. Forwarding every SMS on the device would
  // otherwise fill raw_emails with personal, non-financial messages — the
  // automation should filter, and this is the backstop if it does not.
  if (!parserForSmsSender(sender)) {
    return NextResponse.json(
      { error: 'unknown sender', sender, hint: 'Not a configured bank SMS header — see src/config/banks.ts' },
      { status: 422 },
    );
  }

  const receivedAt = parsed.receivedAt != null ? new Date(parsed.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) {
    return NextResponse.json({ error: 'receivedAt is not a valid date' }, { status: 400 });
  }

  // Idempotency key. The automation may retry on a flaky connection, and a
  // retry must not become a second transaction. Content + sender + minute is
  // stable across retries while still letting two genuinely distinct alerts
  // in the same minute through (their text differs).
  const minute = Math.floor(receivedAt.getTime() / 60000);
  const messageId =
    'sms:' + createHash('sha256').update(`${userId}|${sender}|${minute}|${text}`).digest('hex').slice(0, 32);

  const existing = await prisma.rawEmail.findUnique({
    where: { userId_gmailMessageId: { userId, gmailMessageId: messageId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ status: 'duplicate', messageId });
  }

  await prisma.rawEmail.create({
    data: {
      userId,
      gmailMessageId: messageId,
      sender,
      subject: '',
      bodyText: text,
      bodyHtml: null,
      receivedAt,
      parseStatus: 'pending',
    },
  });

  // Parse immediately so the transaction shows up while the user is still
  // looking at their phone, rather than at the next daily cron.
  const result = await runParsePass(userId);

  return NextResponse.json({ status: 'accepted', messageId, parse: result });
}
