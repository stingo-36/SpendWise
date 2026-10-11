'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';

/**
 * SMS ingest setup.
 *
 * A web app cannot read the SMS inbox on any platform — Android exposes no
 * such API to the browser and iOS exposes none to anyone — so the phone does
 * that half. An automation app that holds READ_SMS forwards each bank alert
 * to /api/ingest/sms, which drops it into the same pipeline Gmail feeds.
 */
export default function SmsIngest() {
  const [token, setToken] = useState<string | null>(null);
  const [senders, setSenders] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  // Resolved after mount: window.location is not available during the server
  // render, and a value computed inline there would be frozen into the
  // hydrated HTML as the bare path.
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ingest/token', { cache: 'no-store' });
      if (!res.ok) {
        setError("Couldn't load your ingest token.");
        return;
      }
      const d = await res.json();
      setToken(d.token);
      setSenders(d.senders ?? []);
      setError(null);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const url = `${origin}/api/ingest/sms`;

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-[15px] font-bold">Bank SMS (Android)</h2>
        <p className="text-xs text-muted">
          Your bank texts you the same alerts it emails. Forward those texts here and they become transactions
          alongside the Gmail ones — duplicates across the two are merged automatically.
        </p>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-blush px-3 py-2 text-xs font-semibold text-[rgb(var(--debit))]">
          <Icon name="alert" size={14} className="shrink-0" /> {error}
        </p>
      )}

      <div className="space-y-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Webhook URL</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-2 font-mono text-xs">{url}</code>
            <button onClick={() => copy('url', url)} className="btn-outline shrink-0 px-3 py-1.5 text-xs">
              {copied === 'url' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Authorization header — treat this like a password
          </div>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-2 font-mono text-xs">
              {token == null ? 'Loading…' : revealed ? `Bearer ${token}` : 'Bearer ' + '•'.repeat(24)}
            </code>
            <button onClick={() => setRevealed((v) => !v)} className="btn-outline shrink-0 px-3 py-1.5 text-xs">
              {revealed ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => token && copy('token', `Bearer ${token}`)}
              disabled={!token}
              className="btn-outline shrink-0 px-3 py-1.5 text-xs"
            >
              {copied === 'token' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <details className="rounded-xl bg-surface-2 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold">Set it up on your phone</summary>
        <ol className="mt-2 space-y-2 text-xs text-muted">
          <li>
            <b className="text-text">1.</b> Install MacroDroid or Tasker and grant it SMS permission. That app holds
            the permission — Spendwise itself never can, because a web app has no access to the SMS inbox.
          </li>
          <li>
            <b className="text-text">2.</b> New macro. Trigger: <b className="text-text">SMS Received</b>, filtered to
            these senders so nothing personal ever leaves your phone:
            <div className="mt-1 flex flex-wrap gap-1">
              {senders.map((s) => (
                <code key={s} className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px]">{s}</code>
              ))}
            </div>
          </li>
          <li>
            <b className="text-text">3.</b> Action: <b className="text-text">HTTP POST</b> to the URL above, with the
            Authorization header above, content type <code className="font-mono">application/json</code> and body:
            <pre className="mt-1 overflow-x-auto rounded-lg bg-surface px-2 py-1.5 font-mono text-[10px] leading-relaxed">{`{"sender": "[sms_sender]", "text": "[sms_message]"}`}</pre>
            <span className="text-[11px]">(MacroDroid’s variable names; Tasker uses %SMSRF and %SMSRB.)</span>
          </li>
          <li>
            <b className="text-text">4.</b> Send yourself a test, or wait for the next real alert. Anything the parser
            doesn’t recognise shows up under Parsers rather than being dropped.
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-muted">
          iPhone can’t do this — Apple exposes no SMS access to any third-party app, so Gmail sync is the only route
          there.
        </p>
      </details>
    </section>
  );
}
