import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Shell from '@/components/Shell';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import ScrollMotion from '@/components/ScrollMotion';

// Bricolage Grotesque for titles and headline numbers, Geist for the interface,
// Geist Mono for every amount (see .tabular in globals.css).
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Spendwise',
  description: 'Self-hosted personal expense tracker for Indian bank/UPI transactions',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Spendwise' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  // Next only emits the modern `mobile-web-app-capable`; iOS versions before
  // 17.4 read the apple-prefixed one, and without it the home-screen icon
  // opens in a Safari tab instead of full screen.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#0d1014',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browser extensions (password managers, screen recorders, etc.) inject
    // attributes onto <html>/<body> before React hydrates, which otherwise
    // trips a hydration mismatch the app can do nothing about.
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ServiceWorkerRegister />
        <ScrollMotion />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
