/**
 * Manual duplicate sweep — the same logic sync runs automatically
 * (src/lib/dedupe.ts), but over ALL history and for every user.
 *
 * Run it once against the production DB before `prisma db push` adds the
 * unique(user_id, raw_email_id) index: creating that index fails while
 * duplicates exist.
 *
 *   npm run dedupe            # report only, changes nothing
 *   npm run dedupe -- --apply # collapse the duplicates
 */
import { prisma } from '../src/lib/db';
import { dedupeTransactions } from '../src/lib/dedupe';

const apply = process.argv.includes('--apply');

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  let groups = 0;
  let removed = 0;

  for (const u of users) {
    console.log(`user ${u.id} (${u.email}):`);
    const res = await dedupeTransactions(u.id, { sinceDays: null, apply, log: (s) => console.log(s) });
    if (!res.groups) console.log('  no duplicates');
    groups += res.groups;
    removed += res.removed;
  }

  console.log(`\n${groups} duplicate clusters · ${removed} extra rows.`);
  if (!groups) console.log('Nothing to do — safe to run `npx prisma db push`.');
  else if (apply) console.log('Removed. Now run `npx prisma db push --accept-data-loss`.');
  else console.log('Dry run — re-run with `--apply` to remove them.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
