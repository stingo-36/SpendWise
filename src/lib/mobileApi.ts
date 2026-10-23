import { NextRequest, NextResponse } from 'next/server';

/**
 * Shared bits for the /api/mobile/* routes the Kaizen app calls.
 *
 * They authenticate with a bearer token or a password in the body, never a
 * cookie, so allowing any origin is safe — and needed for the app's web
 * preview, which runs on its own origin.
 */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function mobileJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
