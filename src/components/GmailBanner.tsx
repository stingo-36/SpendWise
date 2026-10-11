'use client';

import { useEffect, useState } from 'react';

/**
 * App-wide call-to-action to connect Gmail. Renders on every page until a
 * refresh token exists. Hidden once connected. Links straight into the OAuth
 * flow at /api/auth/google.
 */
export default function GmailBanner() {
  const [state, setState] = useState<'loading' | 'connected' | 'disconnected' | 'misconfigured'>('loading');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setEmail(d?.gmail?.email ?? null);
        setState(d?.gmail?.connected ? 'connected' : 'disconnected');
      })
      .catch(() => live && setState('disconnected'));
    return () => {
      live = false;
    };
  }, []);

  if (state === 'loading' || state === 'connected') return null;

  return (
    <div className="mb-4 rounded-xl border border-accent/40 bg-accent/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">Connect Gmail to start</div>
        <div className="text-xs text-muted">
          Read-only access to your bank alert emails (scope: gmail.readonly). The app never sends or modifies anything.
        </div>
      </div>
      <a
        href="/api/auth/google"
        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white text-center"
      >
        ✉️ Connect Gmail
      </a>
    </div>
  );
}
