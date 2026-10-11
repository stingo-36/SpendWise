/**
 * Wipe synced data so the next sync starts from a clean slate.
 *
 * KEPT: users (login, salary settings, sender preferences), Gmail OAuth
 * tokens, tracked-bank config, registered credit cards, budgets, the category
 * taxonomy and the seeded merchant rules.
 *
 * REMOVED: transactions, deleted-transaction tombstones, raw emails, detected
 * subscriptions, sync cursors, and hand-added merchant rules.
 *
 * Run: npx tsx scripts/reset-data.ts --yes
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to run without --yes (this deletes transaction data).');
    process.exit(1);
  }

  const before = {
    transactions: await prisma.transaction.count(),
    deleted: await prisma.deletedTransaction.count(),
    rawEmails: await prisma.rawEmail.count(),
    subscriptions: await prisma.subscription.count(),
    customRules: await prisma.merchantRule.count({ where: { NOT: { source: 'seed' } } }),
  };

  // Order matters only where FKs point at transactions; everything here is
  // either independent or cascades from the rows being removed.
  await prisma.transaction.deleteMany({});
  await prisma.deletedTransaction.deleteMany({});
  await prisma.rawEmail.deleteMany({});
  await prisma.subscription.deleteMany({});
  // Hand-added rules only — the seeded taxonomy rules stay so categorisation
  // still works on the next sync.
  await prisma.merchantRule.deleteMany({ where: { NOT: { source: 'seed' } } });
  // Clearing the cursor is what makes the next sync re-fetch from scratch
  // rather than resuming after the last history id.
  await prisma.syncState.updateMany({
    data: { lastHistoryId: null, lastSyncAt: null, lastSyncStatus: null },
  });

  const kept = {
    users: await prisma.user.count(),
    gmailTokens: await prisma.gmailToken.count(),
    creditCards: await prisma.creditCard.count(),
    budgets: await prisma.budget.count(),
    categories: await prisma.category.count(),
    seedRules: await prisma.merchantRule.count({ where: { source: 'seed' } }),
  };

  console.log('Removed:', before);
  console.log('Kept:   ', kept);
  console.log('Done — run a sync to repopulate.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
