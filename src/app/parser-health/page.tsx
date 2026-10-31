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

  const parsed = data?.statusCounts.parsed ?? 0;
  const unparsed = data?.statusCounts.unparsed ?? 0;
  const rate = parsed + unparsed > 0 ? Math.round((parsed / (parsed + unparsed)) * 1000) / 10 : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="eyebrow">Where your payments come from</div>
          <h1 className="h-page mt-1.5">Sources</h1>
        </div>
        {/* Retrying the unparsed is the point of this page: a template fix is
            worth nothing until the mail it now understands is queued again. */}
        <div className="flex shrink-0 flex-col gap-2 xs:flex-row">
          <button onClick={() => reparse(false)} disabled={reparsing !== null} className="btn-outline whitespace-nowrap px-4">
            {reparsing === 'pending' ? 'Parsing…' : 'Parse pending'}
          </button>
          <button
            onClick={() => reparse(true)}
            disabled={reparsing !== null}
            className="btn-primary whitespace-nowrap px-4"
            title="Put every unparsed email back in the queue — use after a parser fix"
          >
            {reparsing === 'unparsed' ? 'Retrying…' : 'Retry unparsed'}
          </button>
        </div>
      </header>

      {loading || !data ? (
        <div className="py-10 text-center text-muted">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="card-hero p-5">
            <div className="eyebrow !text-[rgb(var(--sidebar-muted))]">Read correctly</div>
            <div className="mt-2 font-display text-4xl font-extrabold tabular text-amber">{rate == null ? '—' : `${rate}%`}</div>
          </div>
          {(['parsed', 'pending', 'unparsed'] as const).map((k) => (
            <div key={k} className={`rounded-[20px] p-5 ${k === 'unparsed' && unparsed > 0 ? 'bg-blush' : 'bg-surface'}`}>
              <div className={`eyebrow capitalize ${k === 'unparsed' && unparsed > 0 ? '!text-[#8A3109]' : ''}`}>{k}</div>
              <div className="mt-2 font-display text-4xl font-extrabold tabular">{data.statusCounts[k] ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <TrackedBanks />

        {data && (
          <section className="card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="h-section">Couldn’t read</h2>
              {data.unparsedBySender.length > 0 && <span className="chip bg-blush text-[#8A3109]">{unparsed} emails</span>}
            </div>
            {data.unparsedBySender.length > 0 && (
              <ul className="divide-y divide-[#F3D2B6] rounded-2xl border border-[#F3D2B6] bg-[#FFF7F1] px-4">
                {data.unparsedBySender.map((x) => (
                  <li key={x.sender} className="flex justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-mono text-xs">{x.sender}</span>
                    <span className="tabular shrink-0 font-semibold text-debit">{x.count}</span>
                  </li>
                ))}
              </ul>
            )}
            {data.samples.length === 0 ? (
              <p className="text-sm text-muted">Every email matched a template. Nothing to fix.</p>
            ) : (
              data.samples.map((x) => (
                <details key={x.id} className="rounded-2xl border border-border p-4">
                  <summary className="cursor-pointer break-words text-sm">
                    <span className="font-semibold">{x.subject || '(no subject)'}</span>
                    <span className="tabular block text-xs text-muted">
                      {x.sender} · {fmtDateTime(x.receivedAt)}
                    </span>
                  </summary>
                  {x.parseError && <div className="mt-2 text-xs text-debit">error: {x.parseError}</div>}
                  <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-dashed border-border p-3 font-mono text-xs leading-relaxed text-muted">{x.bodyPreview}</pre>
                </details>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}
