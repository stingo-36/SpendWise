/** Local full sync for a user (default user 1). `npm run sync [userId]` */
import { syncGmail } from '../src/lib/gmail';
import { runParsePass } from '../src/lib/parsePass';
import { runCategorizer } from '../src/lib/categorize';

const userId = Number(process.argv[2] || 1);

async function main() {
  console.log(`User ${userId} — fetching from Gmail…`);
  console.log('  ', await syncGmail(userId));
  console.log('Parsing…');
  console.log('  ', await runParsePass(userId));
  console.log('Categorizing…');
  console.log('  ', await runCategorizer(userId));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
