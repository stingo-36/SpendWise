'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import PasswordField from '@/components/PasswordField';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push(params.get('next') || '/dashboard');
      router.refresh();
    } else {
      // A 5xx from the server is an HTML page, not JSON — don't let the parse
      // throw and leave the form stuck on "Signing in…".
      const msg = await res
        .json()
        .then((d) => d.error as string | undefined)
        .catch(() => null);
      setError(msg || `Login failed (${res.status})`);
      setBusy(false);
    }
  }

  return (
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
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        placeholder="Your password"
      />

      {error && (
        <div className="rounded-2xl bg-blush px-4 py-3 text-xs font-medium text-[rgb(var(--debit))]">{error}</div>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full py-3">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-muted">
        No account?{' '}
        <Link href="/signup" className="font-semibold text-text hover:underline">Create one</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Spendwise"
      subtitle="Pick up where your last sync left off."
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
