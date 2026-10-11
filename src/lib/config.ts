/**
 * Global app configuration (Google OAuth app credentials + Anthropic key),
 * shared across all users. UI values (app_settings, id=1) override env vars.
 * Per-user salary settings live on the User row (see salary.ts).
 */
import { prisma } from './db';

export interface ResolvedConfig {
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleRedirectUri: string | null;
  anthropicApiKey: string | null;
  anthropicModel: string;
}

function pick(dbVal: string | null | undefined, envVal: string | undefined): string | null {
  const d = dbVal?.trim();
  if (d) return d;
  const e = envVal?.trim();
  return e ? e : null;
}

export async function getConfig(): Promise<ResolvedConfig> {
  const row = await prisma.appSetting.findUnique({ where: { id: 1 } }).catch(() => null);
  return {
    googleClientId: pick(row?.googleClientId, process.env.GOOGLE_CLIENT_ID),
    googleClientSecret: pick(row?.googleClientSecret, process.env.GOOGLE_CLIENT_SECRET),
    googleRedirectUri: pick(row?.googleRedirectUri, process.env.GOOGLE_REDIRECT_URI),
    anthropicApiKey: pick(row?.anthropicApiKey, process.env.ANTHROPIC_API_KEY),
    anthropicModel: pick(row?.anthropicModel, process.env.ANTHROPIC_MODEL) || 'claude-sonnet-5',
  };
}

/** Save global Google/Anthropic settings. Blank strings leave existing intact. */
export async function saveConfig(input: Record<string, unknown>): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const k of ['googleClientId', 'googleClientSecret', 'googleRedirectUri', 'anthropicApiKey', 'anthropicModel']) {
    const v = input[k];
    if (typeof v === 'string' && v.trim()) data[k] = v.trim();
  }
  await prisma.appSetting.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}
