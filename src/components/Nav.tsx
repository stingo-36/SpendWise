'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import InstallApp from './InstallApp';

const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/transactions', label: 'Transactions', icon: 'transactions' },
  { href: '/budget', label: 'Budget', icon: 'budget' },
  { href: '/credit-card', label: 'Credit Card', icon: 'creditcard' },
  { href: '/review', label: 'Review', icon: 'review' },
  { href: '/keywords', label: 'Keywords', icon: 'keywords' },
  { href: '/subscriptions', label: 'Subscriptions', icon: 'subscriptions' },
  { href: '/parser-health', label: 'Parsers', icon: 'parsers' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    // Back to the landing page — signing out should feel like leaving the app,
    // not like being bounced to a sign-in wall.
    router.push('/');
    router.refresh();
  }

  const Content = (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="flex items-center gap-2.5 px-2 mb-7">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-amber text-[rgb(var(--ink))] text-lg font-bold">₹</div>
        <div>
          <div className="text-[15px] font-semibold leading-tight text-white">Spendwise</div>
          <div className="text-xs text-[rgb(var(--sidebar-muted))]">Expense tracker</div>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`group flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm transition-colors ${
              isActive(l.href) ? 'bg-amber text-[rgb(var(--ink))] font-semibold' : 'text-[rgb(var(--sidebar-muted))] hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            <Icon name={l.icon} size={18} className="shrink-0" />
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto space-y-2">
        <InstallApp
          className="flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-sm text-[rgb(var(--sidebar-muted))] transition-colors hover:bg-white/[0.06] hover:text-white"
          label="Install app"
        />
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-sm text-[rgb(var(--sidebar-muted))] transition-colors hover:bg-white/[0.06] hover:text-white">
          <Icon name="logout" size={18} className="shrink-0" />
          Sign out
        </button>
        <div className="px-3 text-[11px] text-[rgb(var(--sidebar-muted))]/70">Read-only · self-hosted</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile / tablet top bar with hamburger (< lg) */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-safe border-b border-border bg-surface/95 backdrop-blur">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-full hover:bg-surface-2 text-text">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-xl bg-amber text-[rgb(var(--ink))] text-sm font-bold">₹</div>
          <span className="font-semibold">Spendwise</span>
        </div>
      </div>

      {/* Desktop sidebar (lg+) */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-3 lg:left-3 lg:rounded-[28px] bg-[rgb(var(--sidebar))] shadow-ink">
        {Content}
      </aside>

      {/* Mobile / tablet drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setOpen(false)} />
          {/* Scrolls: nine links plus the footer don't fit a landscape phone,
              and the notch eats the left edge under viewportFit: 'cover'. */}
          <aside className="absolute left-0 inset-y-0 w-72 max-w-[82vw] overflow-y-auto bg-[rgb(var(--sidebar))] pl-[env(safe-area-inset-left)] shadow-2xl rounded-r-[28px] animate-slide-in">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-3 grid h-8 w-8 place-items-center rounded-lg text-[rgb(var(--sidebar-muted))] hover:bg-white/10 hover:text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
            {Content}
          </aside>
        </div>
      )}
    </>
  );
}
