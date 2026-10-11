'use client';

import { useState } from 'react';
import { runSync } from '@/lib/syncClient';

// Triggers the full ingestion pipeline (fetch → parse → categorize).
export default function SyncButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await runSync();
      if (!data.ok) throw new Error(data.error || 'Sync failed');
      if (data.busy || !data.sync || !data.parse || !data.categorize) {
        setMsg(data.message || 'Sync already running…');
      } else {
        setMsg(`+${data.sync.inserted} emails · ${data.parse.parsed} parsed · ${data.categorize.byRule + data.categorize.byLlm} categorized`);
      }
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sync}
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? 'Syncing…' : '↻ Sync now'}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
