'use client';

import { useCallback, useEffect, useState } from 'react';

interface Sender { address: string; enabled: boolean }
interface BuiltIn { name: string; senders: Sender[] }

export default function TrackedBanks() {
  const [builtIn, setBuiltIn] = useState<BuiltIn[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [sender, setSender] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch('/api/banks', { cache: 'no-store' }).then((r) => r.json());
    setBuiltIn(d.builtIn ?? []);
    setCustom(d.custom ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!sender.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/banks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: sender.trim() }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setSender('');
      setMsg('Added — its emails will be included on the next sync.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }
  // Built-in senders can't be deleted (they ship with a parser) but they can be
  // switched off, which drops them from the Gmail query.
  async function toggle(address: string, enabled: boolean) {
    await fetch('/api/banks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: address, enabled }),
    });
    await load();
  }

  async function remove(s: string) {
    await fetch(`/api/banks?sender=${encodeURIComponent(s)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-[15px] font-bold">Tracked bank emails</h2>
        <p className="text-xs text-muted">These sender addresses are scanned in your Gmail. Add your bank if it isn’t listed.</p>
      </div>

      {/* Built-in banks with parsers */}
      <div className="space-y-2">
        {builtIn.map((b) => {
          const on = b.senders.filter((s) => s.enabled).length;
          return (
            <div key={b.name} className="rounded-2xl bg-surface-2 p-3.5">
              <div className="text-sm font-semibold mb-2">
                {b.name}
                {on > 0 ? (
                  <span className="text-[10px] text-credit ml-1.5 font-medium">✓ auto-parsed</span>
                ) : (
                  <span className="text-[10px] text-muted ml-1.5 font-medium">all senders off</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {b.senders.map((s) => (
                  <span
                    key={s.address}
                    // A long sender can't wrap inside a pill, so cap the pill at
                    // the card width and let the address itself truncate.
                    className={`inline-flex max-w-full items-center gap-1 rounded-full border py-1 pl-3 pr-1 font-mono text-xs transition-colors ${
                      s.enabled ? 'bg-surface border-border text-text' : 'bg-transparent border-dashed border-border text-muted line-through'
                    }`}
                  >
                    <span className="min-w-0 truncate" title={s.address}>{s.address}</span>
                    <button
                      onClick={() => toggle(s.address, !s.enabled)}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-sm leading-none transition-colors ${
                        s.enabled ? 'text-muted hover:bg-debit hover:text-white' : 'text-muted hover:bg-credit hover:text-white'
                      }`}
                      aria-label={s.enabled ? `Stop scanning ${s.address}` : `Scan ${s.address} again`}
                      title={s.enabled ? 'Stop scanning this sender' : 'Scan this sender again'}
                    >
                      {s.enabled ? '\u00d7' : '+'}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom senders */}
      <div className="border-t border-border pt-4">
        <div className="text-sm font-semibold mb-2">Your added senders</div>
        {custom.length === 0 ? (
          <p className="text-xs text-muted mb-3">None yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {custom.map((s) => (
              <span key={s} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-sand py-1 pl-3 pr-1 font-mono text-xs text-text">
                <span className="min-w-0 truncate" title={s}>{s}</span>
                <button onClick={() => remove(s)} className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted hover:bg-debit hover:text-white" aria-label={`Remove ${s}`}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={sender} onChange={(e) => setSender(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="e.g. alerts@yourbank.com" className="input sm:flex-1" />
          <button onClick={add} disabled={busy} className="btn-primary shrink-0 px-4 py-2">Add</button>
        </div>
        {msg && <div className="mt-2 text-xs text-credit">{msg}</div>}
        <p className="mt-2 text-[11px] text-muted">
          Added banks are <span className="font-medium">fetched</span> right away. If their format isn’t recognized yet, those emails
          show up as <span className="font-medium">unparsed</span> below — that’s the signal a new parser template is needed.
        </p>
      </div>
    </section>
  );
}
