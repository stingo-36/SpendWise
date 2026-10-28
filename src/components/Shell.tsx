'use client';

import { usePathname } from 'next/navigation';
import Nav from './Nav';
import GmailBanner from './GmailBanner';
import AutoSync from './AutoSync';
import SyncStatus from './SyncStatus';

// Full-bleed layout for auth pages; app chrome (nav + banner) for everything else.
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === '/' || pathname === '/login' || pathname === '/signup';
  // The admin console manages accounts, not a mailbox: no Gmail banner or auto-sync.
  const admin = pathname === '/admin' || pathname.startsWith('/admin/');

  if (bare) return <>{children}</>;

  return (
    <>
      {!admin && <AutoSync />}
      {!admin && <SyncStatus />}
      <Nav />
      <main className="lg:pl-[264px] min-h-screen pt-14 lg:pt-0">
        <div className="mx-auto max-w-[1600px] px-safe py-5 pb-10 sm:px-6 lg:px-8">
          {!admin && <GmailBanner />}
          {children}
        </div>
      </main>
    </>
  );
}
