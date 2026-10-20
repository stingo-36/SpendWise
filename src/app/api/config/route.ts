import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

/**
 * Global app credentials (Google OAuth app + Anthropic key). Shared across
 * users, so admins only: anyone else could repoint the OAuth redirect and
 * capture other users' Gmail grants. Secret values are never returned.
 */
export async function GET(req: NextRequest) {
  const adminId = await requireAdmin(req);
  if (adminId instanceof NextResponse) return adminId;
  const cfg = await getConfig();
  return NextResponse.json({
    googleClientIdSet: Boolean(cfg.googleClientId),
    googleClientSecretSet: Boolean(cfg.googleClientSecret),
    googleRedirectUri: cfg.googleRedirectUri ?? '',
    anthropicApiKeySet: Boolean(cfg.anthropicApiKey),
    anthropicModel: cfg.anthropicModel,
  });
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin(req);
  if (adminId instanceof NextResponse) return adminId;
  const body = await req.json().catch(() => ({}));
  await saveConfig({
    googleClientId: body.googleClientId,
    googleClientSecret: body.googleClientSecret,
    googleRedirectUri: body.googleRedirectUri,
    anthropicApiKey: body.anthropicApiKey,
    anthropicModel: body.anthropicModel,
  });
  return NextResponse.json({ ok: true });
}
