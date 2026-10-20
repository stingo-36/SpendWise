/**
 * Create (or reset the password of) the admin account.
 *
 *   npm run seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env so the password never lands
 * in the repo. The account only gets admin rights when its email is also in
 * ADMIN_EMAILS — set that wherever the app runs (locally and on Vercel).
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { isAdminEmail } from '../src/lib/admin';

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email || password.length < 6) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (6+ characters) in .env');
  if (!isAdminEmail(email)) throw new Error(`${email} is not an admin email (admin@spendwise.app or one in ADMIN_EMAILS)`);

  const passwordHash = hashPassword(password);
  const user = await prisma.user.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } });
  console.log(`Admin account ${email} ready (id ${user.id}).`);
}

main()
  .catch((e) => { console.error(e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
