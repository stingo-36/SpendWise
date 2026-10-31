'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Icon from '@/components/Icon';
import { getSyncState, runSync, subscribeSync } from '@/lib/syncClient';
import { DEFAULT_STATEMENT_DAY, MAX_STATEMENT_DAY } from '@/lib/billingCycle';

interface Card {
  id: number;
  last4: string;
  label: string;
  txnCount: number;
}

const STEPS = ['Connect Gmail', 'Add your cards', 'First sync'] as const;
const ordinal = (n: number) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/**
 * First-run setup, right after sign-up: connect Gmail, say which cards are
 * credit cards (and when their bill is generated), then run the first sync.
 * Every step can be skipped and redone later from Settings and Cards.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [gmail, setGmail] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [statementDay, setStatementDay] = useState(DEFAULT_STATEMENT_DAY);
  const [last4, setLast4] = useState('');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
  const [gmailError, setGmailError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setGmail(d?.gmail ?? { connected: false, email: null });
        // Back from Google's consent screen: carry on with the next step.
        const q = new URLSearchParams(window.location.search);
        if (d?.gmail?.connected && q.get('gmail') === 'connected') setStep(1);
        setGmailError(q.get('gmail_error'));
      })
      .catch(() => setGmail({ connected: false, email: null }));
  }, []);

  const loadCards = useCallback(async () => {
    const d = await fetch('/api/credit-cards', { cache: 'no-store' }).then((r) => r.json());
    setCards(d.cards ?? []);
    if (d.statementDay) setStatementDay(d.statementDay);
  }, []);
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function addCard() {
    setMsg(null);
    const res = await fetch('/api/credit-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ last4, label: label.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(d.error || 'Could not add the card');
      return;
    }
    setLast4('');
    setLabel('');
    if (d.reclassified > 0) setMsg(`${d.reclassified} past charge${d.reclassified === 1 ? '' : 's'} found on that card.`);
    await loadCards();
  }

  async function removeCard(c: Card) {
    await fetch(`/api/credit-cards?id=${c.id}`, { method: 'DELETE' });
    await loadCards();
  }

  async function changeDay(day: number) {
    setStatementDay(day);
    await fetch('/api/credit-cards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statementDay: day }) });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-safe py-4 sm:px-8">
        <span className="flex items-center gap-2.5 font-display text-xl font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[rgb(var(--ink))] text-amber">₹</span>
          SpendWise
        </span>
        <div className="flex max-w-md flex-1 basis-60 items-center gap-3">
          <span className="tabular text-xs text-muted">
            Step {step + 1} of {STEPS.length}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-[rgb(var(--ink))] transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <Link href="/dashboard" className="px-2 py-3 text-sm font-semibold text-muted hover:text-text">
          Skip for now
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-safe py-8 sm:px-8 lg:flex-row lg:items-start">
        <ol className="flex gap-2 overflow-x-auto lg:w-60 lg:flex-col">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                onClick={() => setStep(i)}
                className={`flex min-h-12 w-full items-center gap-3 whitespace-nowrap rounded-2xl px-4 text-left text-sm ${
                  i === step ? 'bg-[rgb(var(--ink))] font-semibold text-white' : 'text-muted hover:bg-surface'
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    i === step ? 'bg-amber text-[rgb(var(--ink))]' : i < step ? 'bg-[rgb(var(--peri))] text-white' : 'border-[1.5px] border-muted-soft'
                  }`}
                >
                  {i < step ? <Icon name="check" size={14} /> : i + 1}
                </span>
                {s}
              </button>
            </li>
          ))}
        </ol>

        <section className="card flex flex-1 flex-col gap-6 p-5 sm:p-8">
          {step === 0 && (
            <>
              <div>
                <h1 className="h-page">Connect your Gmail</h1>
                <p className="mt-3 max-w-xl leading-relaxed text-muted">
                  SpendWise reads the alert emails your bank sends — HDFC, ICICI, Axis, SBI and any sender you add. Access is read-only: nothing is ever sent,
                  moved or deleted.
                </p>
              </div>
              {gmail?.connected ? (
                <div className="flex items-center gap-3 rounded-2xl bg-sky p-4">
                  <span className="tile h-10 w-10 bg-[rgb(var(--peri))] text-white">
                    <Icon name="check" size={18} />
                  </span>
                  <div>
                    <div className="font-bold">Connected</div>
                    <div className="tabular text-xs text-muted">{gmail.email}</div>
                  </div>
                </div>
              ) : (
                <>
                {gmailError && <p className="rounded-2xl bg-blush p-3 text-sm text-[#6B2A0A]">Gmail connection failed: {gmailError}</p>}
                <a href="/api/auth/google?return=onboarding" className="btn-primary self-start px-6">
                  Connect Gmail
                </a>
                </>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h1 className="h-page">Which cards are credit cards?</h1>
                <p className="mt-3 max-w-xl leading-relaxed text-muted">
                  Bank alerts don’t say credit or debit. Add each credit card so its charges count as spend without leaving your balance until the bill is paid.
                </p>
              </div>
              {cards.length > 0 && (
                <ul className="space-y-2">
                  {cards.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3.5">
                      <span className="grid h-9 w-14 place-items-center rounded-lg bg-[rgb(var(--ink))] font-mono text-xs text-amber">{c.last4}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{c.label}</div>
                        <div className="text-xs text-muted">{c.txnCount} past charges found</div>
                      </div>
                      <button onClick={() => removeCard(c)} className="icon-btn-danger" aria-label={`Remove ${c.label}`}>
                        <Icon name="trash" size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1.5 text-xs font-semibold sm:w-32">
                  Last 4 digits
                  <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="0000" className="input tabular" />
                </label>
                <label className="flex flex-1 flex-col gap-1.5 text-xs font-semibold">
                  Name
                  <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && last4.length === 4 && addCard()} placeholder="e.g. HDFC Regalia" className="input" />
                </label>
                <button onClick={addCard} disabled={last4.length !== 4} className="btn-primary">
                  Add card
                </button>
              </div>
              {msg && <p className="text-sm text-muted">{msg}</p>}
              <label className="flex flex-wrap items-center gap-2.5 text-sm font-semibold">
                Bill generates on the
                <select value={statementDay} onChange={(e) => changeDay(Number(e.target.value))} className="select !w-auto">
                  {Array.from({ length: MAX_STATEMENT_DAY }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {ordinal(i + 1)}
                    </option>
                  ))}
                </select>
                of every month
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="h-page">Bring in your payments</h1>
                <p className="mt-3 max-w-xl leading-relaxed text-muted">
                  The first sync reads this month’s alerts and sorts each payment. After this it runs by itself every day. Anything it isn’t sure about lands in your
                  Inbox for one tap.
                </p>
              </div>
              <button onClick={() => runSync()} disabled={sync.running || !gmail?.connected} className="btn-primary self-start px-6">
                <Icon name="repeat" size={15} className={sync.running ? 'animate-spin' : undefined} />
                {sync.running ? `Syncing… ${sync.transactions} so far` : sync.finishedAt ? 'Sync again' : 'Run first sync'}
              </button>
              {!gmail?.connected && <p className="text-sm text-debit">Connect Gmail first (step 1).</p>}
              {sync.result && <p className={`text-sm ${sync.result.ok ? 'text-credit' : 'text-debit'}`}>{sync.result.text}</p>}
            </>
          )}

          <div className="mt-auto flex flex-wrap justify-between gap-3 border-t border-border pt-5">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="btn-outline">
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="btn-accent px-6">
                Continue — {STEPS[step + 1].toLowerCase()} →
              </button>
            ) : (
              <button onClick={() => router.push('/dashboard')} className="btn-accent px-6">
                Go to Home →
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
