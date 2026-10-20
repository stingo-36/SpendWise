'use client';

import { useEffect, useState } from 'react';
import { runSync } from '@/lib/syncClient';
import Icon from './Icon';

// Triggers the full ingestion pipeline (fetch → parse → categorize). The result
// shows as a popup so the header layout never shifts around the button.
export default function SyncButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 4000 : 8000);
    return () => clearTimeout(t);
  }, [toast]);

  async function sync() {
    setBusy(true);
    setToast(null);
    try {
      const data = await runSync();
      if (!data.ok) throw new Error(data.error || 'Sync failed');
      if (data.busy || !data.sync || !data.parse || !data.categorize) {
        setToast({ ok: true, text: data.message || 'A sync is already running…' });
      } else {
        const added = data.parse.parsed;
        setToast({
          ok: true,
          text: added
            ? `Synced: ${added} new transaction${added === 1 ? '' : 's'} from ${data.sync.inserted} email${data.sync.inserted === 1 ? '' : 's'}`
            : 'Synced: you’re up to date',
        });
      }
      onDone?.();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={sync} disabled={busy} className="btn-primary whitespace-nowrap px-4 py-2">
        <Icon name="repeat" size={15} className={busy ? 'animate-spin' : undefined} />
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-[rgb(var(--ink))] px-4 py-3 text-sm text-white shadow-ink animate-fade-up sm:left-auto sm:right-6 sm:mx-0"
        >
          <span className={`tile mt-0.5 h-6 w-6 shrink-0 ${toast.ok ? 'bg-[rgb(var(--credit))]' : 'bg-[rgb(var(--debit))]'}`}>
            <Icon name={toast.ok ? 'check' : 'alert'} size={13} />
          </span>
          <span className="flex-1 leading-snug">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-white/60 hover:text-white">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
    </>
  );
}
