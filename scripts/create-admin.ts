/**
 * Create (or reset the password of) an admin account.
 *
 *   npm run seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env so the password never lands
 * in the repo, and sets the account's is_admin flag. After that the admin can
 * change its email and password from the console itself.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!email || password.length < 6) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (6+ characters) in .env');

  const passwordHash = hashPassword(password);
  const user = await prisma.user.upsert({ where: { email }, update: { passwordHash, isAdmin: true }, create: { email, passwordHash, isAdmin: true } });
  console.log(`Admin account ${email} ready (id ${user.id}).`);
}

main()
  .catch((e) => { console.error(e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
