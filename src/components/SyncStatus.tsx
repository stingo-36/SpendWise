'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { clearSyncResult, getSyncState, monthName, subscribeSync } from '@/lib/syncClient';
import Icon from './Icon';

/**
 * Floating sync progress, then the result. Lives in the app shell so it stays
 * on screen on every page while a sync runs in the background.
 */
export default function SyncStatus() {
  const s = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);

  useEffect(() => {
    if (!s.result) return;
    const t = setTimeout(clearSyncResult, s.result.ok ? 5000 : 10000);
    return () => clearTimeout(t);
  }, [s.result]);

  if (!s.running && !s.result) return null;
  const ok = s.running || s.result?.ok;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-[rgb(var(--ink))] px-4 py-3 text-sm text-white shadow-ink animate-fade-up sm:left-auto sm:right-6 sm:mx-0"
    >
      <span className={`tile mt-0.5 h-6 w-6 shrink-0 ${s.running ? 'bg-white/15' : ok ? 'bg-[rgb(var(--credit))]' : 'bg-[rgb(var(--debit))]'}`}>
        <Icon name={s.running ? 'repeat' : ok ? 'check' : 'alert'} size={13} className={s.running ? 'animate-spin' : undefined} />
      </span>
      <span className="flex-1 leading-snug">
        {s.running ? (
          <>
            Syncing {monthName(s.month)}…
            <span className="block text-xs text-white/60">
              {s.emails || s.transactions
                ? `${s.emails} email${s.emails === 1 ? '' : 's'} fetched · ${s.transactions} transaction${s.transactions === 1 ? '' : 's'} so far`
                : 'Keeps going while you use other pages'}
            </span>
          </>
        ) : (
          s.result?.text
        )}
      </span>
      {!s.running && (
        <button onClick={clearSyncResult} aria-label="Dismiss" className="text-white/60 hover:text-white">
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
}
