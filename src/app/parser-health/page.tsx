'use client';

import { useCallback, useEffect, useState } from 'react';
import { fmtDateTime } from '@/lib/format';
import TrackedBanks from '@/components/TrackedBanks';

interface Health {
  statusCounts: Record<string, number>;
  unparsedBySender: { sender: string; count: number }[];
  samples: { id: number; sender: string; subject: string; receivedAt: string; parseError: string | null; bodyPreview: string }[];
}

export default function ParserHealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [reparsing, setReparsing] = useState<'pending' | 'unparsed' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/parser-health');
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function reparse(retryUnparsed = false) {
    setReparsing(retryUnparsed ? 'unparsed' : 'pending');
    await fetch(`/api/parse${retryUnparsed ? '?retryUnparsed=1' : ''}`, { method: 'POST' });
    await load();
    setReparsing(null);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="h-page">Parser health</h1>
          <p className="text-sm text-muted">Unparsed emails are the discovery mechanism for new bank templates.</p>
        </div>
        {/* Retrying the unparsed is the point of this page: a template fix is
            worth nothing until the mail it now understands is queued again. */}
        <div className="flex shrink-0 flex-col gap-2 xs:flex-row">
          <button onClick={() => reparse(false)} disabled={reparsing !== null} className="btn-outline w-full whitespace-nowrap px-4 py-2 xs:w-auto">
            {reparsing === 'pending' ? 'Re-parsing…' : 'Parse pending'}
          </button>
          <button
            onClick={() => reparse(true)}
            disabled={reparsing !== null}
            className="btn-primary w-full whitespace-nowrap px-4 py-2 xs:w-auto"
            title="Put every unparsed email back in the queue — use after a parser fix"
          >
            {reparsing === 'unparsed' ? 'Retrying…' : 'Retry unparsed'}
          </button>
        </div>
      </header>

      <TrackedBanks />

      {loading || !data ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['pending', 'parsed', 'ignored', 'unparsed'].map((k) => (
              <div key={k} className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs text-muted capitalize">{k}</div>
                <div className="text-xl font-semibold tabular">{data.statusCounts[k] ?? 0}</div>
              </div>
            ))}
          </div>

          {data.unparsedBySender.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold mb-2">Unparsed by sender</h2>
              <ul className="text-sm divide-y divide-border">
                {data.unparsedBySender.map((s) => (
                  <li key={s.sender} className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate font-mono">{s.sender}</span>
                    <span className="shrink-0 text-debit">{s.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Unparsed samples</h2>
            {data.samples.length === 0 ? (
              <p className="text-sm text-muted">No unparsed emails — every template matched. 🎯</p>
            ) : (
              data.samples.map((s) => (
                <details key={s.id} className="rounded-lg border border-border bg-surface p-3">
                  <summary className="cursor-pointer break-words text-sm">
                    <span className="font-medium">{s.subject || '(no subject)'}</span>
                    <span className="text-muted"> · {s.sender} · {fmtDateTime(s.receivedAt)}</span>
                  </summary>
                  {s.parseError && <div className="mt-2 text-xs text-debit">error: {s.parseError}</div>}
                  <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted bg-surface-2 rounded p-2">{s.bodyPreview}</pre>
                </details>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
