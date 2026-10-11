import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * Global app credentials (Google OAuth app + Anthropic key). Shared across users;
 * set by whoever hosts. Secret values are never returned.
 */
export async function GET() {
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
