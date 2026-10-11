/**
 * Per-user pipeline lock.
 *
 * Sync can be triggered from four places at once — the Sync button, AutoSync on
 * page load, the Settings page, and the 2am cron. Two overlapping parse passes
 * read the same `pending` emails and each insert a transaction for them, which
 * is how a single click ends up doubling the ledger.
 *
 * This lock is deliberately in-process and schema-free. An earlier version
 * claimed a `sync_state.syncing_since` column, which meant that deploying the
 * code without running `prisma db push` broke sync outright — and, because
 * /api/status reads the same model, took the Gmail connection banner down with
 * it. A lock that can break the app it protects is worse than a narrower lock:
 * duplicates that slip past a single instance are removed by dedupeTransactions
 * on the very next sync, so the failure mode is a tidy-up, not a wrong ledger.
 *
 * What this covers: concurrent requests hitting the same server instance — the
 * dev server, a self-hosted deployment, or one warm serverless container, which
 * is where the overlapping-click case actually lands. What it does not cover:
 * two separate instances starting at the same instant. For that, the defences
 * are parsePass's pre-insert check, the optional unique(user_id, raw_email_id)
 * index, and the dedupe sweep.
 */

const running = new Set<number>();

export class SyncBusyError extends Error {
  constructor() {
    super('A sync is already running for this account — try again in a moment.');
    this.name = 'SyncBusyError';
  }
}

/** Run `fn` holding this user's pipeline lock. Throws SyncBusyError if held. */
export async function withSyncLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  if (running.has(userId)) throw new SyncBusyError();
  running.add(userId);
  try {
    return await fn();
  } finally {
    running.delete(userId);
  }
}
