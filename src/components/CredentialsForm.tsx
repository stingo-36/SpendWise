'use client';

import { useEffect, useState } from 'react';

interface ConfigStatus {
  googleClientIdSet: boolean;
  googleClientSecretSet: boolean;
  googleRedirectUri: string;
  anthropicApiKeySet: boolean;
  anthropicModel: string;
}

/**
 * Enter Google OAuth credentials (and optionally the Anthropic key) directly in
 * the UI — stored in the DB, no .env editing. Secrets are never sent back to the
 * browser; a "Saved ✓" indicator shows when a value is already stored.
 */
export default function CredentialsForm({ onSaved }: { onSaved?: () => void }) {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-5');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/config');
    const d: ConfigStatus = await res.json();
    setStatus(d);
    setRedirectUri(d.googleRedirectUri || defaultRedirect());
    setModel(d.anthropicModel || 'claude-sonnet-5');
  }

  useEffect(() => {
    load();
  }, []);

  function defaultRedirect(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/api/auth/google/callback`;
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleClientId: clientId || undefined,
          googleClientSecret: clientSecret || undefined,
          googleRedirectUri: redirectUri || undefined,
          anthropicApiKey: anthropicKey || undefined,
          anthropicModel: model || undefined,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setClientId('');
      setClientSecret('');
      setAnthropicKey('');
      setMsg('Saved ✓ — you can now Connect Gmail below.');
      await load();
      onSaved?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">API credentials</h2>
        <p className="text-xs text-muted">
          Enter these here instead of the .env file. Stored in your database. Secrets are never shown back.
        </p>
      </div>

      <Field
        label="Google Client ID"
        saved={status?.googleClientIdSet}
        value={clientId}
        onChange={setClientId}
        placeholder="…apps.googleusercontent.com"
      />
      <Field
        label="Google Client Secret"
        saved={status?.googleClientSecretSet}
        value={clientSecret}
        onChange={setClientSecret}
        placeholder="GOCSPX-…"
        password
      />
      <div>
        <label className="block text-xs text-muted mb-1">Redirect URI (add this exact value to your OAuth client)</label>
        <input
          value={redirectUri}
          onChange={(e) => setRedirectUri(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-2 px-2 py-2 text-sm font-mono"
        />
      </div>

      <div className="pt-1 border-t border-border" />
      <Field
        label="Anthropic API Key (optional — enables LLM categorization)"
        saved={status?.anthropicApiKeySet}
        value={anthropicKey}
        onChange={setAnthropicKey}
        placeholder="sk-ant-…"
        password
      />
      <div>
        <label className="block text-xs text-muted mb-1">Anthropic model</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-md border border-border bg-surface-2 px-2 py-2 text-sm font-mono" />
      </div>

      {msg && <div className="text-xs text-credit">{msg}</div>}

      <button onClick={save} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        {saving ? 'Saving…' : 'Save credentials'}
      </button>
    </section>
  );
}

function Field({
  label,
  saved,
  value,
  onChange,
  placeholder,
  password,
}: {
  label: string;
  saved?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  password?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-muted mb-1">
        {label}
        {saved && <span className="rounded-full bg-credit/15 text-credit px-1.5 py-0.5 text-[10px]">saved ✓</span>}
      </label>
      <input
        type={password ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={saved ? '•••••• (leave blank to keep)' : placeholder}
        autoComplete="off"
        className="w-full rounded-md border border-border bg-surface-2 px-2 py-2 text-sm font-mono"
      />
    </div>
  );
}
