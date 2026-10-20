/**
 * The Settings "Pipeline" steps for any user, so the admin console can run
 * them on an account's behalf. Mirrors /api/sync, /api/parse, /api/categorize,
 * /api/subscriptions/detect and /api/transactions/dedupe, which run the same
 * library calls for the signed-in user.
 */
import { prisma } from './db';
import { isConnected, syncGmail, GmailAuthError } from './gmail';
import { runParsePass } from './parsePass';
import { runCategorizer } from './categorize';
import { dedupeTransactions } from './dedupe';
import { detectSubscriptions } from './subscriptions';
import { llmConfigured } from './llm';
import { withSyncLock } from './syncLock';

export const PIPELINE_STEPS = ['sync', 'parse', 'categorize', 'subscriptions', 'dedupe'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

const n = (x: number, one: string, many = `${one}s`) => `${x} ${x === 1 ? one : many}`;

/** Run one step and describe what it did in a sentence. */
export async function runPipelineStep(userId: number, step: PipelineStep): Promise<{ ok: boolean; summary: string }> {
  switch (step) {
    case 'sync':
      return withSyncLock(userId, async () => {
        let fetched = '';
        let ok = true;
        try {
          const s = await syncGmail(userId);
          fetched = `Fetched ${n(s.inserted, 'new email')}`;
        } catch (err) {
          if (!(err instanceof GmailAuthError)) throw err;
          ok = false;
          fetched = `Gmail skipped: ${err.message}`;
        }
        const p = await runParsePass(userId);
        const d = await dedupeTransactions(userId, { sinceDays: 120 });
        const c = await runCategorizer(userId);
        return {
          ok,
          summary: `${fetched} · parsed ${n(p.parsed, 'transaction')} · removed ${n(d.removed, 'duplicate')} · categorised ${c.byRule + c.byLlm}`,
        };
      });
    case 'parse':
      return withSyncLock(userId, async () => {
        const p = await runParsePass(userId, 500);
        const d = await dedupeTransactions(userId, { sinceDays: 120 });
        return {
          ok: true,
          summary: `Read ${n(p.processed, 'email')}: ${n(p.parsed, 'new transaction')}, ${p.unparsed} not recognised, ${p.ignored} ignored · removed ${n(d.removed, 'duplicate')}`,
        };
      });
    case 'categorize': {
      const c = await runCategorizer(userId);
      return { ok: true, summary: `Checked ${c.scanned}: ${c.byRule} by keyword rules, ${c.byLlm} by AI, ${c.queued} left for review` };
    }
    case 'subscriptions': {
      const s = await detectSubscriptions(userId);
      return { ok: true, summary: `Scanned ${n(s.merchantsScanned, 'merchant')}: ${s.created} new, ${s.updated} updated, ${s.priceChanged} price changes, ${s.stopped} stopped` };
    }
    case 'dedupe': {
      const d = await withSyncLock(userId, () => dedupeTransactions(userId, { sinceDays: null }));
      return { ok: true, summary: d.removed ? `Merged ${n(d.groups, 'group')}, removed ${n(d.removed, 'duplicate')}` : 'No duplicates found' };
    }
  }
}

/** The same counts the Settings page shows, for any user. */
export async function pipelineStatus(userId: number) {
  const [gmail, rawEmails, pending, unparsed, transactions, reviewQueue, sync, llm] = await Promise.all([
    isConnected(userId).catch(() => ({ connected: false, email: null })),
    prisma.rawEmail.count({ where: { userId } }),
    prisma.rawEmail.count({ where: { userId, parseStatus: 'pending' } }),
    prisma.rawEmail.count({ where: { userId, parseStatus: 'unparsed' } }),
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.count({ where: { userId, categoryId: null, categoryLocked: false } }),
    prisma.syncState.findUnique({ where: { userId } }),
    llmConfigured(),
  ]);
  return {
    gmail,
    llmConfigured: llm,
    counts: { rawEmails, pending, unparsed, transactions, reviewQueue },
    lastSyncAt: sync?.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: sync?.lastSyncStatus ?? null,
  };
}
