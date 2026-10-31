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
    <section className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="h-section">Tracked senders</h2>
        <p className="mt-1 text-xs text-muted">These sender addresses are scanned in your Gmail. Add your bank if it isn’t listed.</p>
      </div>

      {/* Add a sender — first, so it isn't buried under the built-in list. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-[#DCE8B4] bg-sand p-3">
        <label htmlFor="new-sender" className="text-xs font-semibold">Add a bank sender</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="new-sender" value={sender} onChange={(e) => setSender(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="e.g. alerts@yourbank.com" className="input sm:flex-1" />
          <button onClick={add} disabled={busy || !sender.trim()} className="btn-primary shrink-0 px-5">Add</button>
        </div>
        {msg && <div className="text-xs font-semibold text-credit">{msg}</div>}
        <p className="text-[11px] leading-relaxed text-muted">
          Fetched right away. If the format isn’t recognised yet, those emails show under “Couldn’t read” — the signal a new template is needed.
        </p>
      </div>

      {custom.length > 0 && (
        <div className="rounded-2xl border border-border p-3.5">
          <div className="mb-2 text-sm font-semibold">Your added senders</div>
          <div className="flex flex-wrap gap-1.5">
            {custom.map((s) => (
              <span key={s} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-white py-1 pl-3 pr-1 font-mono text-xs">
                <span className="min-w-0 truncate" title={s}>{s}</span>
                <button onClick={() => remove(s)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#FBE3D3] text-[#9A3412] hover:bg-debit hover:text-white" aria-label={`Remove ${s}`}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Built-in banks: each sender with an on/off switch. */}
      <div className="flex flex-col gap-3">
        {builtIn.map((b) => {
          const on = b.senders.filter((x) => x.enabled).length;
          return (
            <div key={b.name} className="overflow-hidden rounded-2xl border border-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--ink))] font-display font-extrabold text-amber">{b.name.charAt(0)}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{b.name}</span>
                <span className={`chip ${on > 0 ? 'bg-sky text-[rgb(var(--peri-2))]' : 'bg-blush text-[#8A3109]'}`}>
                  {on > 0 ? `✓ ${on} of ${b.senders.length} on` : 'All off'}
                </span>
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {b.senders.map((x) => (
                  <li key={x.address} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`min-w-0 flex-1 truncate font-mono text-xs ${x.enabled ? '' : 'text-muted line-through'}`} title={x.address}>
                      {x.address}
                    </span>
                    <button
                      role="switch"
                      aria-checked={x.enabled}
                      onClick={() => toggle(x.address, !x.enabled)}
                      aria-label={x.enabled ? `Stop scanning ${x.address}` : `Scan ${x.address} again`}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${x.enabled ? 'bg-[rgb(var(--ink))]' : 'bg-[rgb(var(--border))]'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${x.enabled ? 'left-[22px] bg-amber' : 'left-0.5 bg-white'}`} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
