'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Icon from '@/components/Icon';
import InstallApp from '@/components/InstallApp';
import { getSyncState, runSync, subscribeSync } from '@/lib/syncClient';
import { NAV_GROUPS, TAB_LINKS } from '@/lib/navLinks';

// Pages already on the tab bar don't need repeating here.
const ON_TABS = new Set(TAB_LINKS.map((t) => t.href));

/** The phone's "everything else" menu, grouped like the desktop sidebar. */
export default function MorePage() {
  const router = useRouter();
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
  const [inbox, setInbox] = useState(0);

  useEffect(() => {
    fetch('/api/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInbox(d?.counts?.reviewQueue ?? 0))
      .catch(() => {});
  }, [sync.finishedAt]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <div className="eyebrow">Everything else</div>
        <h1 className="h-page mt-1">More</h1>
      </header>

      <section className="card-ink flex items-center gap-3 p-4">
        <span className={`h-2.5 w-2.5 rounded-full bg-amber ${sync.running ? 'animate-pulse' : ''}`} />
        <div className="flex-1">
          <div className="font-bold">{sync.running ? 'Syncing…' : 'Gmail sync'}</div>
          <div className="text-xs text-[rgb(var(--sidebar-muted))]">Fetches new bank alerts and sorts them</div>
        </div>
        <button onClick={() => runSync()} disabled={sync.running} className="btn-accent px-4">
          Sync now
        </button>
      </section>

      {NAV_GROUPS.map((g) => {
        const links = g.links.filter((l) => !ON_TABS.has(l.href));
        if (!links.length) return null;
        return (
          <nav key={g.label} aria-label={g.label} className="space-y-2">
            <div className="eyebrow">{g.label}</div>
            <div className="grid grid-cols-2 gap-2">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-border bg-surface px-3 font-semibold hover:border-[rgb(var(--text))]/40">
                  <Icon name={l.icon} size={20} />
                  {l.label}
                  {l.href === '/review' && inbox > 0 && (
                    <span className="ml-auto rounded-full bg-[#E8833A] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[rgb(var(--ink))]">{inbox}</span>
                  )}
                </Link>
              ))}
            </div>
          </nav>
        );
      })}

      <div className="flex flex-col gap-2 pt-2">
        <InstallApp className="btn-outline w-full" label="Install app" />
        <button onClick={logout} className="btn-ghost w-full justify-center text-debit">
          Sign out
        </button>
      </div>
    </div>
  );
}
