'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Icon from './Icon';
import InstallApp from './InstallApp';
import AddTransaction from './AddTransaction';
import { getSyncState, runSync, subscribeSync } from '@/lib/syncClient';
import { ADMIN_LINKS, DATA_CHANGED_EVENT, NAV_GROUPS, TAB_LINKS, isActivePath, tabFor } from '@/lib/navLinks';

/** "2 min ago" — short enough for the sidebar footer. */
function ago(iso: string | null): string {
  if (!iso) return 'Not synced yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Synced just now';
  if (mins < 60) return `Synced ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Synced ${hrs} h ago`;
  return `Synced ${Math.round(hrs / 24)} d ago`;
}

/**
 * App chrome: a dark sidebar grouped Money / Plan / Tidy / System on desktop,
 * and a bottom tab bar on phones (Home, Activity, +, Cards, More) where the
 * rest of the pages live behind More.
 */
export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [inbox, setInbox] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsAdmin(!!d?.isAdmin))
      .catch(() => {});
  }, []);

  // Inbox count and last sync for the footer; refreshed after every sync,
  // page change, and whenever a page reports it changed transactions.
  const [changed, setChanged] = useState(0);
  useEffect(() => {
    const bump = () => setChanged((n) => n + 1);
    window.addEventListener(DATA_CHANGED_EVENT, bump);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, bump);
  }, []);
  useEffect(() => {
    if (isAdmin) return;
    fetch('/api/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setInbox(d.counts?.reviewQueue ?? 0);
        setLastSync(d.lastSyncAt ?? null);
      })
      .catch(() => {});
  }, [isAdmin, sync.finishedAt, pathname, changed]);

  const isActive = (href: string) => isActivePath(pathname, href);

  // The admin account has no spending of its own, so any other page is empty
  // for it — e.g. after login sent it back to ?next=/dashboard.
  useEffect(() => {
    if (isAdmin && !ADMIN_LINKS.some((l) => isActive(l.href))) router.replace('/admin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, pathname]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    // Back to the landing page — signing out should feel like leaving the app,
    // not like being bounced to a sign-in wall.
    router.push('/');
    router.refresh();
  }

  const navItem = (l: { href: string; label: string; icon: string }) => (
    <Link
      key={l.href}
      href={l.href}
      aria-current={isActive(l.href) ? 'page' : undefined}
      className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors ${
        isActive(l.href) ? 'bg-amber font-semibold text-[rgb(var(--ink))]' : 'text-[rgb(var(--sidebar-muted))] hover:bg-white/[0.07] hover:text-white'
      }`}
    >
      <Icon name={l.icon} size={18} className="shrink-0" />
      {l.label}
      {l.href === '/review' && inbox > 0 && (
        <span
          className={`ml-auto rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
            isActive(l.href) ? 'bg-[rgb(var(--ink))] text-amber' : 'bg-[#E8833A] text-[rgb(var(--ink))]'
          }`}
        >
          {inbox}
        </span>
      )}
    </Link>
  );

  return (
    <>
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[248px] lg:flex-col lg:gap-5 lg:overflow-y-auto bg-[rgb(var(--sidebar))] px-3.5 py-6">
        <Link href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2.5 px-2 font-display text-[21px] font-extrabold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-amber text-[17px] text-[rgb(var(--ink))]">₹</span>
          SpendWise
        </Link>
        {isAdmin ? (
          <>
            <span className="ml-2 self-start rounded-full bg-[rgb(var(--ink-2))] px-2.5 py-1 text-xs font-semibold text-amber">Admin console</span>
            <nav aria-label="Admin" className="flex flex-col gap-0.5">
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgb(var(--sidebar-muted))]/80">Admin</div>
              {ADMIN_LINKS.map(navItem)}
            </nav>
          </>
        ) : (
          NAV_GROUPS.map((g) => (
            <nav key={g.label} aria-label={g.label} className="flex flex-col gap-0.5">
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgb(var(--sidebar-muted))]/80">{g.label}</div>
              {g.links.map(navItem)}
            </nav>
          ))
        )}
        <div className="mt-auto flex flex-col gap-2.5 rounded-2xl bg-white/[0.05] p-3 text-xs">
          {!isAdmin && (
            <>
              <div className="flex items-center gap-2 font-semibold text-white">
                <span className={`h-2 w-2 rounded-full ${sync.running ? 'animate-pulse bg-amber' : 'bg-amber'}`} />
                {sync.running ? 'Syncing…' : ago(lastSync)}
              </div>
              <button
                onClick={() => runSync()}
                disabled={sync.running}
                className="btn min-h-10 border border-white/10 bg-[rgb(var(--ink-2))] text-white hover:bg-white/10"
              >
                <Icon name="repeat" size={14} className={sync.running ? 'animate-spin' : undefined} />
                {sync.running ? 'Syncing…' : 'Sync now'}
              </button>
              <InstallApp className="flex items-center gap-2 rounded-lg px-1 py-1 text-[rgb(var(--sidebar-muted))] hover:text-white" label="Install app" />
            </>
          )}
          <button onClick={logout} className="flex items-center gap-2 rounded-lg px-1 py-1 text-left text-[rgb(var(--sidebar-muted))] hover:text-white">
            <Icon name="logout" size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Phone / tablet bottom tab bar (< lg) */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex items-center justify-around bg-[rgb(var(--ink))] px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {isAdmin ? (
          <>
            {ADMIN_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={`flex min-w-[88px] flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold ${isActive(l.href) ? 'text-amber' : 'text-[rgb(var(--sidebar-muted))]'}`}>
                <Icon name={l.icon} size={22} />
                {l.label}
              </Link>
            ))}
            <button onClick={logout} className="flex min-w-[88px] flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold text-[rgb(var(--sidebar-muted))]">
              <Icon name="logout" size={22} />
              Sign out
            </button>
          </>
        ) : (
          TAB_LINKS.map((t, i) => {
            const on = tabFor(pathname) === t.href;
            const tab = (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={`relative flex min-w-[56px] flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold ${on ? 'text-amber' : 'text-[rgb(var(--sidebar-muted))]'}`}
              >
                <Icon name={t.icon} size={22} />
                {t.label}
                {t.href === '/more' && inbox > 0 && <span className="absolute right-2 top-0.5 h-2 w-2 rounded-full bg-[#E8833A]" aria-label={`${inbox} in Inbox`} />}
              </Link>
            );
            // The add button sits in the middle of the bar.
            return i === 2
              ? [
                  <button
                    key="add"
                    onClick={() => setAdding(true)}
                    aria-label="Add transaction"
                    className="-mt-7 grid h-14 w-14 place-items-center rounded-[18px] bg-amber text-[rgb(var(--ink))] shadow-ink active:scale-95"
                  >
                    <Icon name="plus" size={26} strokeWidth={2.2} />
                  </button>,
                  tab,
                ]
              : tab;
          })
        )}
      </nav>

      {adding && (
        <AddTransaction
          onAdded={() => {
            window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
            router.refresh();
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
