/** Re-run the parser over stored raw_emails. `npm run parse [userId]` */
import { runParsePass } from '../src/lib/parsePass';
const userId = Number(process.argv[2] || 1);
runParsePass(userId).then((r) => { console.log(r); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
