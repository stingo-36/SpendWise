'use client';

import { usePathname } from 'next/navigation';
import Nav from './Nav';
import GmailBanner from './GmailBanner';
import AutoSync from './AutoSync';
import SyncStatus from './SyncStatus';

// Full-bleed layout for auth pages; app chrome (nav + banner) for everything else.
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Onboarding is signed-in but full-screen: it has its own header and progress.
  const bare = pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/onboarding';
  // The admin console manages accounts, not a mailbox: no Gmail banner or auto-sync.
  const admin = pathname === '/admin' || pathname.startsWith('/admin/');

  if (bare) return <>{children}</>;

  return (
    <>
      {!admin && <AutoSync />}
      {!admin && <SyncStatus />}
      <Nav />
      {/* Bottom padding clears the phone tab bar. */}
      <main className="min-h-screen pb-28 lg:pb-0 lg:pl-[248px]">
        <div className="mx-auto max-w-[1440px] px-safe pb-10 pt-5 sm:px-6 sm:pt-7 lg:px-10">
          {!admin && <GmailBanner />}
          {children}
        </div>
      </main>
    </>
  );
}
