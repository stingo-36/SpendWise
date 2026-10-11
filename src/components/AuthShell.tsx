import Link from 'next/link';

/* Shared two-pane frame for /login and /signup: the pitch on the left (dark
   ink panel, desktop only), the form on the right. Keeps both pages identical
   apart from their copy. */
export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Pitch panel ─────────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-[rgb(var(--ink))] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[rgb(var(--amber))]/10" aria-hidden />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-white/[0.03]" aria-hidden />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber text-[rgb(var(--ink))] text-lg font-bold">₹</span>
          <span className="text-[15px] font-extrabold tracking-tight">Spendwise</span>
        </Link>

        <div className="relative my-auto max-w-md py-12">
          <h2 className="text-[clamp(1.8rem,2.6vw,2.4rem)] font-extrabold leading-[1.15] tracking-tight">
            Your bank already emails you every transaction.
          </h2>
          <p className="mt-4 leading-relaxed text-white/60">
            Spendwise reads those alerts on a schedule and files them for you — categorised, deduplicated
            and counted against your budget. You never log an expense by hand.
          </p>

          {/* Miniature proof: one alert becoming one ledger row. */}
          <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Inbox</div>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">
              Rs.<span className="font-semibold text-white">486.00</span> debited from **4417 to{' '}
              <span className="font-semibold text-white">SWIGGY</span>
            </p>
            <div className="my-3 flex items-center gap-2 text-[10px] font-semibold text-white/35">
              <span className="h-px flex-1 bg-white/10" />
              parsed automatically
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-bold">S</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold leading-tight">Swiggy</div>
                <div className="text-[11px] text-white/45">Food › Delivery · UPI</div>
              </div>
              <span className="text-[13px] font-bold tabular text-[rgb(var(--amber))]">−₹486</span>
            </div>
          </div>
        </div>

        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/50">
          {['Read-only Gmail access', 'Self-hosted', 'No bank passwords, ever'].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--amber))]" />
              {t}
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────────────── */}
      <main className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:min-h-0">
        <div className="mx-auto w-full max-w-sm">
          {/* Brand mark, mobile only — the panel carries it on desktop. */}
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber text-[rgb(var(--ink))] text-lg font-bold">₹</span>
            <span className="text-[15px] font-extrabold tracking-tight">Spendwise</span>
          </Link>

          <div className="animate-fade-up">
            <span className="chip bg-sky text-[rgb(var(--peri-2))]">{eyebrow}</span>
            <h1 className="h-page mt-3 leading-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>

          <div className="animate-fade-up mt-7" style={{ animationDelay: '80ms' }}>
            {children}
          </div>

          <p className="animate-fade-up mt-8 text-center text-xs text-muted" style={{ animationDelay: '140ms' }}>
            <Link href="/" className="hover:text-text hover:underline">← Back to home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
