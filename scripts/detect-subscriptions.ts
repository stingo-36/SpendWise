/** Run subscription detection. `npm run detect-subs [userId]` */
import { detectSubscriptions } from '../src/lib/subscriptions';
const userId = Number(process.argv[2] || 1);
detectSubscriptions(userId).then((r) => { console.log(r); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
