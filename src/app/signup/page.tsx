'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import PasswordField from '@/components/PasswordField';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push('/settings?welcome=1');
      router.refresh();
    } else {
      const msg = await res
        .json()
        .then((d) => d.error as string | undefined)
        .catch(() => null);
      setError(msg || `Sign up failed (${res.status})`);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Free · self-hosted"
      title="Create your account"
      subtitle="Two fields now, then connect Gmail and your last three months land on their own."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">Email</label>
          <input
            type="email"
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
        </div>

        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder="At least 6 characters"
          strength
        />

        {error && (
          <div className="rounded-2xl bg-blush px-4 py-3 text-xs font-medium text-[rgb(var(--debit))]">{error}</div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full py-3">
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <ul className="space-y-2 rounded-2xl bg-surface-2 px-4 py-3.5">
          {[
            'Read-only Gmail scope — mail is never modified',
            'Your data stays in your own database',
            'Export everything to CSV whenever you want',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-xs text-muted">
              <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full bg-credit text-[9px] text-white">✓</span>
              {t}
            </li>
          ))}
        </ul>

        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-text hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
