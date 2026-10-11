/**
 * Seed the category taxonomy and merchant rules. Idempotent — safe to re-run.
 *
 * Categories: Food, EMI, SIP, Transport, Shopping, House, Bills (user's set)
 * plus Transfers (not spend) and Other (catch-all) for data integrity.
 *
 * Rules may carry a `label` — a human-readable display name applied to matches.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Sub = { name: string; isExpense?: boolean };
type Cat = { name: string; isExpense: boolean; subs: Sub[] };

const TAXONOMY: Cat[] = [
  { name: 'Food', isExpense: true, subs: [{ name: 'Delivery' }, { name: 'Grocery' }, { name: 'Hotels' }, { name: 'Cafes' }] },
  // EMI subs: specific loans + credit-card buckets. Credit-card subs (Axis CC,
  // HDFC CC) have NO auto-rules — assign card payments manually.
  { name: 'EMI', isExpense: true, subs: [{ name: 'HDFC Loan' }, { name: 'InCred' }, { name: 'Axis CC' }, { name: 'HDFC CC' }, { name: 'BNPL' }, { name: 'Other' }] },
  { name: 'SIP', isExpense: true, subs: [{ name: 'Mutual funds' }, { name: 'Stocks' }, { name: 'Recurring deposit' }] },
  { name: 'Transport', isExpense: true, subs: [{ name: 'Cabs' }, { name: 'Fuel' }, { name: 'Public transport' }, { name: 'Tolls & parking' }] },
  { name: 'Shopping', isExpense: true, subs: [{ name: 'Online' }, { name: 'Clothing' }, { name: 'Electronics' }, { name: 'Personal care' }] },
  { name: 'House', isExpense: true, subs: [{ name: 'Rent' }, { name: 'Maintenance' }, { name: 'Repairs' }] },
  { name: 'Bills', isExpense: true, subs: [{ name: 'Mobile' }, { name: 'Broadband' }, { name: 'Electricity' }, { name: 'Subscriptions' }, { name: 'DTH' }] },
  // ── Income (is_expense = false) — one tap each in the review queue. ──────
  { name: 'Salary', isExpense: false, subs: [] },
  { name: 'Bonus', isExpense: false, subs: [] },
  { name: 'Extra', isExpense: false, subs: [] },
  { name: 'Transfers', isExpense: false, subs: [{ name: 'To people' }, { name: 'To self' }, { name: 'Cash withdrawal' }] },
  { name: 'Other', isExpense: true, subs: [{ name: 'Uncategorized' }, { name: 'Health' }, { name: 'Misc' }] },
];

/** [pattern, topCategory, subcategory|null, priority, label?] */
const SEED_RULES: [string, string, string | null, number, string?][] = [
  // ── Food · Delivery ──────────────────────────────────────────────────────
  ['SWIGGY', 'Food', 'Delivery', 20, 'Swiggy'],
  ['ZOMATO', 'Food', 'Delivery', 20, 'Zomato'],
  ['EATSURE', 'Food', 'Delivery', 15, 'EatSure'],
  ['FAASOS', 'Food', 'Delivery', 15, 'Faasos'],
  ['BOX8', 'Food', 'Delivery', 15, 'Box8'],
  // ── Food · Grocery ───────────────────────────────────────────────────────
  ['BLINKIT', 'Food', 'Grocery', 20, 'Blinkit'],
  ['ZEPTO', 'Food', 'Grocery', 20, 'Zepto'],
  ['INSTAMART', 'Food', 'Grocery', 20, 'Swiggy Instamart'],
  ['BIGBASKET', 'Food', 'Grocery', 18, 'BigBasket'],
  ['DUNZO', 'Food', 'Grocery', 12, 'Dunzo'],
  ['DMART', 'Food', 'Grocery', 15, 'DMart'],
  ['LICIOUS', 'Food', 'Grocery', 12, 'Licious'],
  // ── Food · Hotels (dining out: hotels, restaurants, bars, pubs, clubs) ────
  ['HOTEL', 'Food', 'Hotels', 8],
  ['RESTAURANT', 'Food', 'Hotels', 8],
  ['RESTRO', 'Food', 'Hotels', 8],
  ['DHABA', 'Food', 'Hotels', 8],
  ['KITCHEN', 'Food', 'Hotels', 6],
  ['PUB', 'Food', 'Hotels', 8],
  ['CLUB', 'Food', 'Hotels', 6],
  ['LOUNGE', 'Food', 'Hotels', 8],
  ['BREWERY', 'Food', 'Hotels', 8],
  ['BREWORKS', 'Food', 'Hotels', 8],
  ['WINE', 'Food', 'Hotels', 8],
  ['LIQUOR', 'Food', 'Hotels', 8],
  ['TONIQUE', 'Food', 'Hotels', 10, 'Tonique'],
  ['BIRYANI', 'Food', 'Hotels', 8],
  ['DOMINOS', 'Food', 'Hotels', 10, "Domino's"],
  ['MCDONALD', 'Food', 'Hotels', 10, "McDonald's"],
  ['KFC', 'Food', 'Hotels', 10, 'KFC'],
  // ── Food · Cafes ─────────────────────────────────────────────────────────
  ['CAFE', 'Food', 'Cafes', 8],
  ['CHAAYOS', 'Food', 'Cafes', 10, 'Chaayos'],
  ['STARBUCKS', 'Food', 'Cafes', 10, 'Starbucks'],
  ['BAKERY', 'Food', 'Cafes', 8],
  // ── EMI (HDFC loan ₹15,755 · InCred ₹9,400; credit cards are manual-only) ──
  ['EMI CHQ', 'EMI', 'HDFC Loan', 20, 'HDFC Loan EMI'],
  ['EMI/', 'EMI', 'HDFC Loan', 18, 'HDFC Loan EMI'],
  ['INCRED', 'EMI', 'InCred', 22, 'InCred EMI'],
  ['ACH D', 'EMI', 'Other', 14, 'Auto-debit EMI'],
  ['NACH', 'EMI', 'Other', 12, 'Auto-debit EMI'],
  ['SNAPMINT', 'EMI', 'BNPL', 18, 'Snapmint'],
  ['BAJAJ FIN', 'EMI', 'BNPL', 14, 'Bajaj Finance EMI'],
  ['HDB FINAN', 'EMI', 'Other', 12, 'HDB Finance EMI'],
  ['SIMPL', 'EMI', 'BNPL', 12, 'Simpl'],
  ['LAZYPAY', 'EMI', 'BNPL', 12, 'LazyPay'],
  // ── SIP / investments ────────────────────────────────────────────────────
  ['SIP', 'SIP', 'Mutual funds', 18, 'SIP'],
  ['ZERODHA', 'SIP', 'Stocks', 18, 'Zerodha'],
  ['GROWW', 'SIP', 'Mutual funds', 18, 'Groww'],
  ['KUVERA', 'SIP', 'Mutual funds', 16, 'Kuvera'],
  ['SMALLCASE', 'SIP', 'Stocks', 16, 'Smallcase'],
  ['INDMONEY', 'SIP', 'Stocks', 14, 'INDmoney'],
  ['ETMONEY', 'SIP', 'Mutual funds', 14, 'ET Money'],
  ['MUTUAL FUND', 'SIP', 'Mutual funds', 14],
  ['NIPPON', 'SIP', 'Mutual funds', 12, 'Nippon MF'],
  ['SBIMF', 'SIP', 'Mutual funds', 12, 'SBI MF'],
  ['ICICIPRU', 'SIP', 'Mutual funds', 12, 'ICICI Pru MF'],
  ['MIRAE', 'SIP', 'Mutual funds', 12, 'Mirae MF'],
  ['UPSTOX', 'SIP', 'Stocks', 14, 'Upstox'],
  // ── Transport ────────────────────────────────────────────────────────────
  ['UBER', 'Transport', 'Cabs', 20, 'Uber'],
  ['OLA', 'Transport', 'Cabs', 18, 'Ola'],
  ['RAPIDO', 'Transport', 'Cabs', 16, 'Rapido'],
  ['IRCTC', 'Transport', 'Public transport', 16, 'IRCTC'],
  ['REDBUS', 'Transport', 'Public transport', 12, 'redBus'],
  ['CLEARTRIP', 'Transport', 'Public transport', 14, 'Cleartrip'],
  ['METRO', 'Transport', 'Public transport', 10],
  ['INDIANOIL', 'Transport', 'Fuel', 12, 'IndianOil'],
  ['IOCL', 'Transport', 'Fuel', 12, 'IndianOil'],
  ['HPCL', 'Transport', 'Fuel', 12, 'HP Petrol'],
  ['BHARAT PETRO', 'Transport', 'Fuel', 12, 'Bharat Petroleum'],
  ['SHELL', 'Transport', 'Fuel', 8, 'Shell'],
  ['FASTAG', 'Transport', 'Tolls & parking', 12, 'FASTag'],
  // ── Shopping ─────────────────────────────────────────────────────────────
  ['AMAZON', 'Shopping', 'Online', 14, 'Amazon'],
  ['FLIPKART', 'Shopping', 'Online', 14, 'Flipkart'],
  ['MYNTRA', 'Shopping', 'Clothing', 14, 'Myntra'],
  ['AJIO', 'Shopping', 'Clothing', 12, 'AJIO'],
  ['NYKAA', 'Shopping', 'Personal care', 14, 'Nykaa'],
  ['MEESHO', 'Shopping', 'Online', 12, 'Meesho'],
  ['UNIXCART', 'Shopping', 'Online', 12, 'Unixcart'],
  ['FIRSTCRY', 'Shopping', 'Online', 12, 'FirstCry'],
  ['CROMA', 'Shopping', 'Electronics', 12, 'Croma'],
  ['RELIANCE DIGITAL', 'Shopping', 'Electronics', 12, 'Reliance Digital'],
  ['DECATHLON', 'Shopping', 'Online', 10, 'Decathlon'],
  // ── House ────────────────────────────────────────────────────────────────
  ['ARUN SUNDERRAJ', 'House', 'Rent', 100, 'Rent — Arun'],
  ['RENT', 'House', 'Rent', 12],
  ['MAINTENANCE', 'House', 'Maintenance', 10],
  ['NOBROKER', 'House', 'Rent', 12, 'NoBroker'],
  // ── Bills & subscriptions ────────────────────────────────────────────────
  ['AIRTEL', 'Bills', 'Mobile', 12, 'Airtel'],
  ['JIO', 'Bills', 'Mobile', 12, 'Jio'],
  ['VODAFONE', 'Bills', 'Mobile', 12, 'Vi'],
  ['ACT FIBERNET', 'Bills', 'Broadband', 12, 'ACT Fibernet'],
  ['BESCOM', 'Bills', 'Electricity', 12, 'BESCOM'],
  ['TATA POWER', 'Bills', 'Electricity', 12, 'Tata Power'],
  ['ADANI', 'Bills', 'Electricity', 10, 'Adani Electricity'],
  ['NETFLIX', 'Bills', 'Subscriptions', 20, 'Netflix'],
  ['SPOTIFY', 'Bills', 'Subscriptions', 20, 'Spotify'],
  ['HOTSTAR', 'Bills', 'Subscriptions', 18, 'Disney+ Hotstar'],
  ['PRIME VIDEO', 'Bills', 'Subscriptions', 16, 'Prime Video'],
  ['YOUTUBE', 'Bills', 'Subscriptions', 14, 'YouTube Premium'],
  ['ZEE', 'Bills', 'Subscriptions', 10, 'ZEE5'],
  ['GOOGLE', 'Bills', 'Subscriptions', 8, 'Google'],
  ['APPLE.COM', 'Bills', 'Subscriptions', 10, 'Apple'],
  ['TATA SKY', 'Bills', 'DTH', 12, 'Tata Play'],
  ['TATASKY', 'Bills', 'DTH', 12, 'Tata Play'],
  // ── Transfers (not spend) ────────────────────────────────────────────────
  ['ATM', 'Transfers', 'Cash withdrawal', 14, 'ATM withdrawal'],
  ['CASH WDL', 'Transfers', 'Cash withdrawal', 14, 'ATM withdrawal'],
];

async function main() {
  console.log('Seeding categories…');
  const idByPath = new Map<string, number>();

  for (const [i, cat] of TAXONOMY.entries()) {
    const existingTop = await prisma.category.findFirst({ where: { name: cat.name, parentId: null } });
    const top = existingTop
      ? await prisma.category.update({ where: { id: existingTop.id }, data: { isExpense: cat.isExpense, sortOrder: i } })
      : await prisma.category.create({ data: { name: cat.name, parentId: null, isExpense: cat.isExpense, sortOrder: i } });
    idByPath.set(cat.name, top.id);

    for (const [j, sub] of cat.subs.entries()) {
      const isExpense = sub.isExpense ?? cat.isExpense;
      const s = await prisma.category.upsert({
        where: { name_parentId: { name: sub.name, parentId: top.id } },
        update: { isExpense, sortOrder: j },
        create: { name: sub.name, parentId: top.id, isExpense, sortOrder: j },
      });
      idByPath.set(`${cat.name}/${sub.name}`, s.id);
    }
  }
  console.log(`  ${idByPath.size} categories seeded.`);

  console.log('Seeding merchant rules…');
  let created = 0;
  for (const [pattern, cat, sub, priority, label] of SEED_RULES) {
    const categoryId = idByPath.get(cat);
    if (!categoryId) {
      console.warn(`  skip rule ${pattern}: unknown category ${cat}`);
      continue;
    }
    const subcategoryId = sub ? idByPath.get(`${cat}/${sub}`) ?? null : null;
    const existing = await prisma.merchantRule.findFirst({ where: { pattern, source: 'seed' } });
    if (existing) {
      await prisma.merchantRule.update({ where: { id: existing.id }, data: { categoryId, subcategoryId, priority, label: label ?? null } });
      continue;
    }
    await prisma.merchantRule.create({ data: { pattern, categoryId, subcategoryId, priority, label: label ?? null, source: 'seed' } });
    created++;
  }
  console.log(`  ${created} merchant rules seeded.`);

  // Seed rules are created with userId = null (global defaults for all users).
  // Per-user sync_state rows are created on signup, not here.
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
