/**
 * Demo account with realistic dummy spending, for trying the dashboard and
 * the Kaizen app without real bank data.
 *
 *   npm run seed:demo
 *
 * Creates test@gmail.com (password: test@gmail.com) if missing, then REPLACES
 * that user's transactions and budgets with ~3 months of generated data up to
 * today. Only the demo user's rows are touched, and the script refuses to run
 * against any other email.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';

const EMAIL = 'test@gmail.com';
const PASSWORD = 'test@gmail.com';
const MONTHS = 3;

// Deterministic PRNG so every run produces the same dataset.
let seed = 20261020;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const between = (a: number, b: number) => Math.round(a + rand() * (b - a));
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

/** A wall-clock IST time as an absolute instant. */
const ist = (y: number, m: number, d: number, h: number, mi = 0) => new Date(Date.UTC(y, m, d, h, mi) - 330 * 60_000);

type Row = {
  merchant: string; amount: number; at: Date; cat: string; sub?: string;
  direction?: 'debit' | 'credit'; instrument?: string; card?: boolean;
};

function monthRows(y: number, m: number, lastDay: number): Row[] {
  const rows: Row[] = [];
  const on = (d: number) => d <= lastDay;
  const day = () => between(1, lastDay);

  if (on(1)) rows.push({ merchant: 'Acme Technologies', amount: 85000, at: ist(y, m, 1, 10), cat: 'Salary', direction: 'credit', instrument: 'netbanking' });
  if (on(3)) rows.push({ merchant: 'Rent - Mr Sharma', amount: 18000, at: ist(y, m, 3, 9, 30), cat: 'House', sub: 'Rent', instrument: 'upi' });
  if (on(5)) rows.push({ merchant: 'Groww SIP', amount: 5000, at: ist(y, m, 5, 8), cat: 'SIP', sub: 'Mutual funds', instrument: 'netbanking' });
  if (on(6)) rows.push({ merchant: 'Own HDFC savings', amount: 10000, at: ist(y, m, 6, 19), cat: 'Transfers', sub: 'To self', instrument: 'upi' });
  if (on(7)) rows.push({ merchant: 'Jio', amount: 399, at: ist(y, m, 7, 11), cat: 'Bills', sub: 'Mobile', instrument: 'upi' });
  if (on(9)) rows.push({ merchant: 'Airtel Xstream Fiber', amount: 999, at: ist(y, m, 9, 12), cat: 'Bills', sub: 'Broadband', instrument: 'upi' });
  if (on(12)) rows.push({ merchant: 'Netflix', amount: 649, at: ist(y, m, 12, 0, 5), cat: 'Bills', sub: 'Subscriptions', instrument: 'card', card: true });
  if (on(14)) rows.push({ merchant: 'Tata Power', amount: between(1500, 2300), at: ist(y, m, 14, 18), cat: 'Bills', sub: 'Electricity', instrument: 'upi' });
  if (on(15)) rows.push({ merchant: 'Spotify', amount: 119, at: ist(y, m, 15, 0, 10), cat: 'Bills', sub: 'Subscriptions', instrument: 'card', card: true });

  const n = Math.round(lastDay / 30 * 1000) / 1000; // scale counts for a partial month
  for (let i = 0; i < Math.round(16 * n); i++) rows.push({ merchant: pick(['Swiggy', 'Zomato']), amount: between(180, 720), at: ist(y, m, day(), between(12, 22), between(0, 59)), cat: 'Food', sub: 'Delivery', instrument: 'upi' });
  for (let i = 0; i < Math.round(7 * n); i++) rows.push({ merchant: pick(['Blinkit', 'Zepto', 'BigBasket']), amount: between(250, 1600), at: ist(y, m, day(), between(8, 21), between(0, 59)), cat: 'Food', sub: 'Grocery', instrument: 'upi' });
  for (let i = 0; i < Math.round(5 * n); i++) rows.push({ merchant: pick(['Starbucks', 'Third Wave Coffee', 'Blue Tokai']), amount: between(220, 480), at: ist(y, m, day(), between(9, 19), between(0, 59)), cat: 'Food', sub: 'Cafes', instrument: 'card', card: true });
  for (let i = 0; i < Math.round(10 * n); i++) rows.push({ merchant: pick(['Uber', 'Ola', 'Rapido']), amount: between(90, 520), at: ist(y, m, day(), between(8, 23), between(0, 59)), cat: 'Transport', sub: 'Cabs', instrument: 'upi' });
  for (let i = 0; i < Math.round(2 * n); i++) rows.push({ merchant: pick(['Indian Oil', 'HP Petrol Pump']), amount: between(1500, 2500), at: ist(y, m, day(), between(9, 20)), cat: 'Transport', sub: 'Fuel', instrument: 'card', card: true });
  for (let i = 0; i < Math.round(3 * n); i++) rows.push({ merchant: pick(['Amazon', 'Myntra', 'Flipkart']), amount: between(600, 3800), at: ist(y, m, day(), between(10, 23), between(0, 59)), cat: 'Shopping', sub: pick(['Online', 'Clothing']), instrument: 'card', card: true });
  if (rand() < 0.7) rows.push({ merchant: 'Apollo Pharmacy', amount: between(150, 900), at: ist(y, m, day(), between(10, 20)), cat: 'Other', sub: 'Health', instrument: 'upi' });
  return rows;
}

async function main() {
  const now = new Date();
  const nowIst = new Date(now.getTime() + 330 * 60_000);
  const [ty, tm, td] = [nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()];

  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) user = await prisma.user.create({ data: { email: EMAIL, passwordHash: hashPassword(PASSWORD) } });
  if (user.email !== EMAIL) throw new Error('refusing to touch a non-demo user');
  const userId = user.id;

  const cats = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  const top = new Map(cats.filter((c) => c.parentId == null).map((c) => [c.name, c.id]));
  const catId = (name: string) => { const id = top.get(name); if (id == null) throw new Error(`missing category ${name} — run npm run db:seed`); return id; };
  const subId = (parent: string, name?: string) => (name ? cats.find((c) => c.parentId === catId(parent) && c.name === name)?.id ?? null : null);

  const rows: Row[] = [];
  for (let k = MONTHS - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(ty, tm - k, 1));
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    const last = k === 0 ? td : new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    rows.push(...monthRows(y, m, last));
  }
  // Something already spent today, so the "today" figure has a value.
  rows.push({ merchant: 'Third Wave Coffee', amount: 340, at: ist(ty, tm, td, 9, 15), cat: 'Food', sub: 'Cafes', instrument: 'card', card: true });
  rows.push({ merchant: 'Swiggy', amount: 486, at: ist(ty, tm, td, 13, 40), cat: 'Food', sub: 'Delivery', instrument: 'upi' });
  const data = rows.filter((r) => r.at <= now).map((r) => ({
    userId, source: 'seed', direction: r.direction ?? 'debit', amount: r.amount, occurredAt: r.at,
    rawMerchant: r.merchant.toUpperCase(), merchant: r.merchant, instrument: r.instrument ?? 'upi', isCreditCard: !!r.card,
    categoryId: catId(r.cat), subcategoryId: subId(r.cat, r.sub), categorySource: 'manual', categoryLocked: true,
  }));

  const budgets = [['Food', 12000], ['Transport', 5000], ['Shopping', 6000], ['Bills', 4000]] as const;

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.budget.deleteMany({ where: { userId } }),
    prisma.transaction.createMany({ data }),
    prisma.budget.createMany({ data: budgets.map(([name, amount]) => ({ userId, categoryId: catId(name), amount })) }),
  ]);

  console.log(`Demo user ${EMAIL} (id ${userId}): ${data.length} transactions, ${budgets.length} budgets.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
