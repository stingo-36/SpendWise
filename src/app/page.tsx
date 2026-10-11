'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import Reveal from '@/components/Reveal';
import InstallApp from '@/components/InstallApp';

/* Issuer brand colours — used at full saturation on the marquee pills. */
const BANKS = [
  { name: 'HDFC Bank', bg: '#004C8F', fg: '#FFFFFF' },
  { name: 'ICICI Bank', bg: '#AE282E', fg: '#FFFFFF' },
  { name: 'State Bank of India', bg: '#22409A', fg: '#FFFFFF' },
  { name: 'Axis Bank', bg: '#97144D', fg: '#FFFFFF' },
  { name: 'Kotak Mahindra', bg: '#ED1C24', fg: '#FFFFFF' },
  { name: 'SBI Card', bg: '#0F1B4C', fg: '#FFFFFF' },
  { name: 'UPI', bg: '#097939', fg: '#FFFFFF' },
  { name: 'RuPay', bg: '#F26722', fg: '#FFFFFF' },
];

const FEATURES = [
  {
    icon: 'transactions',
    tint: 'bg-sky text-[rgb(var(--peri-2))]',
    accent: 'rgb(var(--peri))',
    title: 'Reads your bank emails',
    body: 'Connect Gmail once. Every HDFC, ICICI, SBI and Axis alert — UPI, card, netbanking, auto-debit — is parsed into a clean transaction. Nothing is typed by hand.',
  },
  {
    icon: 'keywords',
    tint: 'bg-mint text-[rgb(var(--credit))]',
    accent: 'rgb(var(--credit))',
    title: 'Categorises itself',
    body: 'Merchant rules catch the regulars instantly. Anything new goes to an AI pass, then to a review queue where one keystroke files it — and teaches the rule for next time.',
  },
  {
    icon: 'creditcard',
    tint: 'bg-lilac text-[rgb(var(--peri-2))]',
    accent: 'rgb(var(--peri-2))',
    title: 'Credit cards, counted correctly',
    body: 'Card charges count as spend but never leave your balance. Register a card by its last four digits and its charges track separately until the bill is paid.',
  },
  {
    icon: 'budget',
    tint: 'bg-sand text-[rgb(var(--amber-2))]',
    accent: 'rgb(var(--amber))',
    title: 'Budgets that hold up',
    body: 'Set a monthly cap per category and watch it fill. Transfers between your own accounts and card bill payments are excluded, so the number means something.',
  },
  {
    icon: 'subscriptions',
    tint: 'bg-blush text-[rgb(var(--debit))]',
    accent: 'rgb(var(--debit))',
    title: 'Finds your subscriptions',
    body: 'Recurring charges are detected from your own history — cadence, median amount, next expected date — including the ones that quietly changed price.',
  },
  {
    icon: 'overview',
    tint: 'bg-mint text-[rgb(var(--credit))]',
    accent: 'rgb(var(--credit))',
    title: 'A month you can read',
    body: 'Week-by-week category spend, money in versus money out, savings rate and top merchants. The whole month on one screen, in rupees.',
  },
];

const STEPS = [
  { n: '01', title: 'Sign in with Gmail', body: 'Read-only access, scoped to bank alert senders. Your mail is never modified.' },
  { n: '02', title: 'Alerts become transactions', body: 'Parsers pull out amount, merchant, date, instrument and account — duplicates merged.' },
  { n: '03', title: 'Review once, done forever', body: 'Confirm the handful the rules missed. Every decision becomes a rule for next month.' },
];

const FAQ = [
  { q: 'Do you ever see my banking password?', a: 'No. Spendwise never touches your bank — it only reads the alert emails your bank already sends you, through Gmail’s read-only API.' },
  { q: 'Which banks work?', a: 'HDFC, ICICI, SBI and Axis ship with parsers, covering UPI, card, netbanking and auto-debit alerts. Any other sender can be added, and unrecognised formats are surfaced so a template can be written.' },
  { q: 'Where does my data live?', a: 'In your own Postgres database, on your own deployment. It is self-hosted by design — there is no shared server holding your statements.' },
  { q: 'What about cash?', a: 'Add it manually in a few seconds. Manual entries are locked so the categoriser never overwrites them.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur bg-[rgb(var(--bg))]/75 border-b border-border/60">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber text-[rgb(var(--ink))] text-lg font-bold">₹</span>
            <span className="text-[15px] font-extrabold tracking-tight">Spendwise</span>
          </Link>
          <nav className="ml-auto hidden sm:flex items-center gap-1 text-sm font-medium text-muted">
            <a href="#features" className="px-3 py-2 rounded-full hover:text-text hover:bg-surface-2 transition-colors">Features</a>
            <a href="#how" className="px-3 py-2 rounded-full hover:text-text hover:bg-surface-2 transition-colors">How it works</a>
            <a href="#faq" className="px-3 py-2 rounded-full hover:text-text hover:bg-surface-2 transition-colors">FAQ</a>
          </nav>
          <div className="ml-auto sm:ml-3 flex items-center gap-2">
            {/* The hero's "I have an account" covers sign-in on small screens. */}
            <InstallApp className="btn-ghost hidden sm:inline-flex whitespace-nowrap gap-1.5" label="Get the app" />
            <Link href="/login" className="btn-ghost hidden xs:inline-flex whitespace-nowrap">Sign in</Link>
            <Link href="/signup" className="btn-primary whitespace-nowrap px-4 sm:px-5">Get started</Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-10 pb-8 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="min-w-0">
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-credit" />
              Built for Indian bank &amp; UPI alerts
            </div>

            <h1 className="animate-fade-up mt-5 text-[clamp(2.05rem,7vw,4rem)] font-extrabold leading-[1.05] tracking-tight" style={{ animationDelay: '60ms' }}>
              <span className="sheen">Every rupee</span>,
              <br />
              accounted for.
            </h1>

            <p className="animate-fade-up mt-5 max-w-lg text-[15px] leading-relaxed text-muted sm:text-[17px]" style={{ animationDelay: '120ms' }}>
              Your bank already emails you every transaction. Spendwise reads those alerts, sorts them into categories,
              and turns a year of noise into a monthly picture you can actually act on.
            </p>

            <div className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={{ animationDelay: '180ms' }}>
              <Link href="/signup" className="btn-primary w-full px-6 py-3 text-[15px] sm:w-auto">
                Start tracking — free
                <span aria-hidden>→</span>
              </Link>
              <Link href="/login" className="btn-outline w-full px-6 py-3 text-[15px] sm:w-auto">I have an account</Link>
              <InstallApp className="btn-ghost w-full justify-center gap-2 px-6 py-3 text-[15px] sm:w-auto" label="Install on your phone" />
            </div>

            <p className="animate-fade-up mt-4 text-xs text-muted" style={{ animationDelay: '220ms' }}>
              Self-hosted · read-only Gmail access · your data stays in your database
            </p>
          </div>

          {/* Dashboard preview */}
          <Reveal delay={80} className="min-w-0">
            <div className="relative min-w-0">
              <HeroPreview />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Bank marquee ─────────────────────────────────────────────────── */}
      <section className="border-y border-border/60 bg-surface/50 py-8 sm:py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted mb-5">Reads alerts from</p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="flex w-max animate-marquee gap-3">
            {[...BANKS, ...BANKS, ...BANKS, ...BANKS].map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-semibold shadow-card sm:px-5 sm:py-2 sm:text-sm"
                style={{ background: b.bg, color: b.fg }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                {b.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Automatic email capture ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-12">
          <Reveal>
            <span className="chip bg-sky text-[rgb(var(--peri-2))]">Fully automatic</span>
            <h2 className="mt-4 text-[clamp(1.6rem,5vw,2.6rem)] font-extrabold tracking-tight">
              It reads your email, so you never log an expense again.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[17px]">
              Every time you pay, your bank sends an alert to your inbox. Spendwise checks Gmail on a schedule,
              finds those alerts, pulls out the amount, merchant, date, card and account — and saves them as
              transactions on their own. No screenshots, no CSV uploads, no typing.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                ['Runs on a schedule', 'A daily sync picks up everything since the last run — including your past three months on day one.'],
                ['Never records twice', 'The same payment alerted by SMS-style mail and a statement mail is matched and merged into one entry.'],
                ['Learns your merchants', 'Each alert is matched to a category rule, so Swiggy is Food and Uber is Travel from the second time onward.'],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={i * 70}>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-credit text-white text-xs">✓</span>
                    <span className="text-sm leading-relaxed">
                      <span className="font-semibold">{t}</span>
                      <span className="text-muted"> — {b}</span>
                    </span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={90}>
            <MailToLedger />
          </Reveal>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-14 sm:py-20 lg:py-24">
        <Reveal>
          <h2 className="text-[clamp(1.6rem,5vw,2.6rem)] font-extrabold tracking-tight max-w-2xl">
            The boring part is the whole point.
          </h2>
          <p className="mt-3 text-muted max-w-xl">
            Expense apps fail because logging expenses is work. This one does the logging, and asks you only what it genuinely can’t infer.
          </p>
        </Reveal>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <article className="card group relative h-full overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                {/* Accent rail — draws itself across the top edge on hover. */}
                <span
                  className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{ background: f.accent }}
                  aria-hidden
                />
                <div className="flex items-start justify-between">
                  <span className={`tile h-12 w-12 ${f.tint} transition-transform duration-300 group-hover:scale-110`}>
                    <Icon name={f.icon} size={22} />
                  </span>
                  <span className="font-mono text-xs font-bold text-muted/40">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="bg-[rgb(var(--ink))] text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20 lg:py-24">
          <Reveal>
            <h2 className="text-[clamp(1.6rem,5vw,2.6rem)] font-extrabold tracking-tight">Set up in three steps.</h2>
            <p className="mt-3 text-white/60 max-w-xl">Roughly five minutes, then it runs itself on a daily schedule.</p>
          </Reveal>

          <div className="mt-10 grid gap-8 sm:mt-12 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="relative">
                  <div className="text-[13px] font-mono font-bold text-[rgb(var(--amber))]">{s.n}</div>
                  <div className="mt-3 h-px w-full bg-white/15" />
                  <h3 className="mt-4 text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20 lg:py-24">
        <Reveal>
          <div className="card grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-10 lg:p-12">
            <div>
              <span className="chip bg-mint text-[rgb(var(--credit))]">Private by construction</span>
              <h2 className="mt-4 text-[clamp(1.5rem,4.5vw,2.3rem)] font-extrabold tracking-tight">
                Nobody else holds your statements.
              </h2>
              <p className="mt-4 text-muted leading-relaxed">
                Spendwise is self-hosted. You deploy it, you own the database, and the only thing it ever asks of Google is
                permission to <em>read</em> mail from the bank senders you list. No credentials, no screen-scraping, no third party
                sitting between you and your money.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                'Read-only Gmail scope — mail is never modified or deleted',
                'Bank passwords are never requested or stored',
                'Session cookies signed with your own secret',
                'Every row scoped to your user id',
                'Export everything to CSV whenever you want',
              ].map((point, i) => (
                <Reveal key={point} delay={i * 60}>
                  <li className="flex items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-credit text-white text-xs">✓</span>
                    <span className="text-sm font-medium">{point}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-14 sm:pb-20 lg:pb-24">
        <Reveal>
          <h2 className="text-[clamp(1.6rem,5vw,2.6rem)] font-extrabold tracking-tight text-center">Questions, answered.</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <details className="card group p-4 sm:p-5 open:shadow-lg transition-shadow">
                <summary className="flex cursor-pointer items-center gap-4 list-none font-semibold">
                  {f.q}
                  <span className="ml-auto shrink-0 text-muted transition-transform duration-300 group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <Reveal>
          <div className="card-ink relative overflow-hidden p-6 text-center sm:p-12 lg:p-16">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[rgb(var(--amber))]/12 animate-float-slow" aria-hidden />
            <div className="absolute -left-20 -bottom-24 h-72 w-72 rounded-full bg-white/[0.04]" aria-hidden />
            <h2 className="relative text-[clamp(1.6rem,5.5vw,3rem)] font-extrabold tracking-tight">
              Find out where it actually went.
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-white/60">
              Connect Gmail and your last three months are categorised before you finish your coffee.
            </p>
            <div className="relative mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <Link href="/signup" className="btn-accent w-full px-7 py-3 text-[15px] sm:w-auto">Create your account</Link>
              <Link href="/login" className="btn w-full border border-white/20 px-7 py-3 text-[15px] text-white hover:bg-white/10 sm:w-auto">Sign in</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center gap-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-amber text-[rgb(var(--ink))] text-sm font-bold">₹</span>
            <span className="font-semibold text-text">Spendwise</span>
          </div>
          <p className="sm:ml-auto text-xs">Self-hosted expense tracking for Indian bank &amp; UPI alerts.</p>
        </div>
      </footer>
    </div>
  );
}

/* A miniature of the real dashboard — same tokens, same card language. */
function HeroPreview() {
  const categories = [
    { name: 'Food & dining', amount: '₹14,380', pct: 78, color: 'rgb(var(--debit))' },
    { name: 'Rent & bills', amount: '₹18,500', pct: 100, color: 'rgb(var(--peri))' },
    { name: 'Travel', amount: '₹6,240', pct: 34, color: 'rgb(var(--amber))' },
    { name: 'Shopping', amount: '₹9,090', pct: 49, color: 'rgb(var(--credit))' },
  ];

  // Six months of spend, drawn as a smooth area so the card has one clear focal point.
  const trend = [38, 44, 35, 52, 41, 48];
  const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const W = 260;
  const H = 72;
  const max = Math.max(...trend) * 1.15;
  const pts = trend.map((v, i) => [(i / (trend.length - 1)) * W, H - (v / max) * H] as const);
  // Catmull-Rom-ish smoothing: mid-point curves keep the line soft without a library.
  const line = pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, '');

  return (
    <div className="min-w-0 overflow-hidden rounded-[28px] border border-border bg-surface shadow-card">
      {/* Window chrome — reads as the real app, not a chart widget. */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--debit))]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--amber))]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--credit))]/70" />
        <span className="ml-2 truncate text-[11px] font-semibold">August 2025</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[10px] font-semibold text-[rgb(var(--credit))]">
          <span className="h-1.5 w-1.5 rounded-full bg-credit" />
          Synced 2m ago
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {/* Headline number + trend */}
        <div className="rounded-2xl bg-[rgb(var(--ink))] p-4 text-white sm:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-white/50 sm:text-[10px]">Spent this month</div>
              <div className="mt-1 text-2xl font-extrabold tabular tracking-tight sm:text-3xl">₹48,210</div>
              <div className="mt-1.5 text-[11px] font-medium text-white/60">
                <span className="text-[rgb(var(--amber))]">↓ 8.4%</span> vs July
              </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-[110px] shrink-0 sm:h-[72px] sm:w-[150px]" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--amber))" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="rgb(var(--amber))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#heroFill)" />
              <path d={line} fill="none" stroke="rgb(var(--amber))" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={pts[pts.length - 1][0] - 2} cy={pts[pts.length - 1][1]} r="4" fill="rgb(var(--amber))" />
            </svg>
          </div>
          <div className="mt-3 flex justify-between text-[9px] font-medium text-white/35">
            {months.map((m) => <span key={m}>{m}</span>)}
          </div>
        </div>

        {/* Money in / out */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-mint p-3.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-[rgb(var(--credit))]">Money in</div>
            <div className="mt-0.5 text-base font-extrabold tabular">₹75,417</div>
          </div>
          <div className="rounded-2xl bg-sand p-3.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-[rgb(var(--amber-2))]">Saved · 36%</div>
            <div className="mt-0.5 text-base font-extrabold tabular">₹27,207</div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="mt-3 rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold">Where it went</span>
            <span className="text-[10px] font-medium text-muted">4 categories</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {categories.map((c, i) => (
              <div key={c.name}>
                <div className="flex items-baseline justify-between gap-3 text-[10px]">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="tabular shrink-0 font-bold text-muted">{c.amount}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="animate-grow-x h-full rounded-full"
                    style={{ width: `${c.pct}%`, background: c.color, animationDelay: `${i * 110}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* One live row, so the card ends on real data */}
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-surface-2 px-3.5 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-blush text-[10px] font-bold text-[rgb(var(--debit))]">S</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold leading-tight">Swiggy</div>
            <div className="truncate text-[9px] text-muted">Food › Delivery · UPI · today</div>
          </div>
          <span className="shrink-0 text-[11px] font-bold tabular text-debit">−₹486</span>
        </div>
      </div>
    </div>
  );
}

/* Shows the core mechanic: a bank alert in the inbox becoming a ledger row. */
function MailToLedger() {
  return (
    <div className="relative">
      {/* Inbox alert */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-xs font-bold text-white" style={{ background: '#004C8F' }}>H</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">HDFC Bank Alerts</div>
            <div className="truncate text-xs text-muted">You have done a UPI txn</div>
          </div>
          <span className="ml-auto text-[11px] text-muted">now</span>
        </div>
        <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-[13px] leading-relaxed text-muted">
          Dear Customer, Rs.<span className="font-semibold text-text">486.00</span> has been debited from account
          <span className="font-semibold text-text"> **4417</span> to <span className="font-semibold text-text">SWIGGY</span> on
          <span className="font-semibold text-text"> 14-08-25</span>. UPI Ref 5218xxxx3390.
        </p>
      </div>

      {/* Arrow */}
      <div className="my-3 flex items-center justify-center gap-2 text-xs font-semibold text-muted">
        <span className="h-px w-10 bg-border" />
        parsed automatically
        <span className="h-px w-10 bg-border" />
      </div>

      {/* Resulting ledger row */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-blush text-sm font-bold text-[rgb(var(--debit))]">S</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-tight">Swiggy</div>
            <div className="text-xs text-muted">Food › Delivery · UPI · HDFC ••4417</div>
          </div>
          <span className="text-sm font-bold tabular text-debit">−₹486</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="chip bg-mint text-[rgb(var(--credit))]">Categorised</span>
          <span className="chip bg-sand text-[rgb(var(--amber-2))]">Counted in August budget</span>
          <span className="chip bg-lilac text-[rgb(var(--peri-2))]">No duplicate found</span>
        </div>
      </div>
    </div>
  );
}
