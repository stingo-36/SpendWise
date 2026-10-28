'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { getSyncState, runSync, subscribeSync } from '@/lib/syncClient';
import Icon from './Icon';

// Triggers the full ingestion pipeline (fetch → parse → categorize) for the
// month on screen. Progress and the result show in SyncStatus, which stays on
// screen while you move between pages.
export default function SyncButton({ month, onDone }: { month?: string; onDone?: () => void }) {
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);

  // Reload the page's data whenever a run finishes — including one started
  // before this page was opened.
  const seen = useRef(sync.finishedAt);
  useEffect(() => {
    if (sync.finishedAt !== seen.current) {
      seen.current = sync.finishedAt;
      onDone?.();
    }
  }, [sync.finishedAt, onDone]);

  return (
    <button onClick={() => runSync(month)} disabled={sync.running} className="btn-primary whitespace-nowrap px-4 py-2">
      <Icon name="repeat" size={15} className={sync.running ? 'animate-spin' : undefined} />
      {sync.running ? 'Syncing…' : 'Sync now'}
    </button>
  );
}
