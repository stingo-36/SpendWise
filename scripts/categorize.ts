/** Run the categorizer pass. `npm run categorize [userId]` */
import { runCategorizer } from '../src/lib/categorize';
const userId = Number(process.argv[2] || 1);
runCategorizer(userId).then((r) => { console.log(r); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
