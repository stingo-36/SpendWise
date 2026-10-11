'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Chrome fires this before showing its own install UI; capturing it lets us
// put the install behind our own button instead of a browser mini-infobar.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop';

function detect(): Platform {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch points are the giveaway.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari never implemented display-mode; it exposes this instead.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const STEPS: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: 'Add Spendwise to your Home Screen',
    steps: [
      'Open this page in Safari (Chrome on iPhone cannot install apps).',
      'Tap the Share button — the square with an arrow pointing up.',
      'Scroll down and tap “Add to Home Screen”.',
      'Tap “Add”. Spendwise now opens full-screen, with no address bar.',
    ],
  },
  android: {
    title: 'Install Spendwise',
    steps: [
      'Tap the ⋮ menu at the top-right of Chrome.',
      'Tap “Install app” (it may read “Add to Home screen”).',
      'Confirm. Spendwise lands in your app drawer like any other app.',
    ],
  },
  desktop: {
    title: 'Install Spendwise',
    steps: [
      'Look for the install icon at the right of the address bar.',
      'Click it, then click “Install”.',
      'Spendwise opens in its own window, out of your browser tabs.',
    ],
  },
};

export default function InstallApp({ className = '', label = 'Install app' }: { className?: string; label?: string }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    setPlatform(detect());
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Already running as an installed app — nothing left to offer.
  if (installed) return null;

  async function install() {
    // Safari and Firefox never fire beforeinstallprompt, so those users get
    // the manual route rather than a dead button.
    if (!prompt) {
      setHelp(true);
      return;
    }
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  const guide = STEPS[platform];

  return (
    <>
      <button type="button" onClick={install} className={className || 'btn-outline whitespace-nowrap'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
        {label}
      </button>

      {/* Portalled to <body>: the landing page's animated ancestors carry a
          transform, which would otherwise make `fixed` resolve against them. */}
      {help && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={guide.title}>
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setHelp(false)} />
          <div className="relative max-h-[90vh] w-full overflow-y-auto card p-4 sm:p-5 rounded-b-none sm:max-w-md sm:rounded-3xl animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber text-[rgb(var(--ink))] text-lg font-bold">₹</div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold leading-tight">{guide.title}</h2>
                <p className="mt-1 text-xs text-muted">It installs from this page — there is no app store download.</p>
              </div>
              <button onClick={() => setHelp(false)} aria-label="Close" className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <ol className="mt-4 space-y-3">
              {guide.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted">{i + 1}</span>
                  <span className="text-muted leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
