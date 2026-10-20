import { afterEach, describe, expect, it } from 'vitest';
import { isAdminEmail, isAdminUser } from '@/lib/admin';

describe('isAdminEmail', () => {
  const saved = process.env.ADMIN_EMAILS;
  afterEach(() => { process.env.ADMIN_EMAILS = saved; });

  it('treats the built-in admin as admin with ADMIN_EMAILS unset', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail('admin@spendwise.app')).toBe(true);
    expect(isAdminEmail(' Admin@SpendWise.app ')).toBe(true);
    expect(isAdminEmail('test@gmail.com')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it('adds the accounts in ADMIN_EMAILS', () => {
    process.env.ADMIN_EMAILS = 'boss@example.com, ops@example.com';
    expect(isAdminEmail('ops@example.com')).toBe(true);
    expect(isAdminEmail('admin@spendwise.app')).toBe(true);
    expect(isAdminEmail('test@gmail.com')).toBe(false);
  });

  it('keeps admin rights on the account flag after an email change', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminUser({ isAdmin: true, email: 'me@renamed.com' })).toBe(true);
    expect(isAdminUser({ isAdmin: false, email: 'test@gmail.com' })).toBe(false);
    expect(isAdminUser({ isAdmin: false, email: 'admin@spendwise.app' })).toBe(true);
    expect(isAdminUser(null)).toBe(false);
  });
});
