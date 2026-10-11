/**
 * Recompute `merchant` from the untouched `rawMerchant` for existing rows.
 *
 * Transactions store the normalized merchant at parse time, so a change to
 * lib/merchant.ts only affects new rows — old ones keep the name they were
 * given. `npm run parse` can't help once raw_emails have been cleared. Run
 * this after editing the normalization pipeline.
 *
 * Run: npx tsx scripts/renormalize-merchants.ts [userId]
 */
import { PrismaClient } from '@prisma/client';
import { normalizeMerchant } from '../src/lib/merchant';

const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  const where = arg ? { userId: Number(arg) } : {};
  const rows = await prisma.transaction.findMany({
    where,
    select: { id: true, rawMerchant: true, merchant: true },
  });

  let changed = 0;
  for (const r of rows) {
    const next = normalizeMerchant(r.rawMerchant);
    if (next && next !== r.merchant) {
      await prisma.transaction.update({ where: { id: r.id }, data: { merchant: next } });
      console.log(`  ${r.merchant}  →  ${next}`);
      changed++;
    }
  }
  console.log(`${changed} of ${rows.length} transaction(s) renamed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
