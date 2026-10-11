import { NextResponse } from 'next/server';

/**
 * Turn a thrown database error into a 503 the UI can display. Serverless
 * deploys fail here when DATABASE_URL is unset/unreachable or the schema was
 * never pushed; without this the route 500s with an empty body and the sign-in
 * form has nothing to show. Only Prisma's error code is exposed — never the
 * connection string.
 */
export function dbErrorResponse(err: unknown): NextResponse {
  const code = (err as { code?: string })?.code;
  const configured = Boolean(process.env.DATABASE_URL);
  console.error('[db] request failed', { code, configured, message: (err as Error)?.message });
  return NextResponse.json(
    {
      error: configured
        ? `Database unavailable${code ? ` (${code})` : ''}. Check the deployment's DATABASE_URL and that the schema has been pushed.`
        : 'Database is not configured: DATABASE_URL is missing in this environment.',
      code: code ?? null,
      databaseUrlConfigured: configured,
    },
    { status: 503 },
  );
}
