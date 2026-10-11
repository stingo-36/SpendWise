# Spendwise

A self-hosted personal finance tracker for Indian bank/UPI transactions. It ingests
transaction-alert emails from Gmail (read-only), parses them into structured
transactions, categorizes merchants automatically with a learning feedback loop,
detects recurring subscriptions, and serves a responsive, installable (PWA)
dashboard.

**Single-user. Self-hosted. Read-only. No third-party financial data services.**

- Stack: **Next.js 15 (App Router, TypeScript)** · **Prisma** · **Postgres** ·
  **Tailwind** · **Anthropic Claude** for categorization.
- Deploys to **Vercel** (with a daily cron), or runs anywhere Node runs.
- Installable as a mobile app (PWA) with an offline app-shell.

---

## Architecture

```
Gmail API ──► raw_emails ──► Parser ──► transactions ──► Dashboard
             (immutable)                     ▲
                                             │
                                       Categorizer
                                    (rules → LLM → queue)
```

Each stage is **independently re-runnable**:

- **Raw emails are stored before any parsing.** A parser bug is fixed by re-running
  the parser over stored raw data (`/api/parse`), never by re-fetching from Gmail.
- **Categorization is a separate pass** over uncategorized transactions
  (`/api/categorize`), so rules can change and be re-applied without re-parsing.
- **Ingestion is idempotent** — deduped on Gmail's message ID; running sync twice
  never creates duplicates.

Key source locations:

| Concern | File |
|---|---|
| Data model | [prisma/schema.prisma](prisma/schema.prisma) |
| Category taxonomy + seed rules | [prisma/seed.ts](prisma/seed.ts) |
| Gmail ingestion (OAuth, fetch) | [src/lib/gmail.ts](src/lib/gmail.ts) |
| Per-bank parsers + dispatch | [src/lib/parsers/](src/lib/parsers/) |
| Merchant normalization (§6) | [src/lib/merchant.ts](src/lib/merchant.ts) |
| Parse pass + dedup (§5.3) | [src/lib/parsePass.ts](src/lib/parsePass.ts) |
| Categorizer + write-back (§7) | [src/lib/categorize.ts](src/lib/categorize.ts) |
| LLM classification (§7.3) | [src/lib/llm.ts](src/lib/llm.ts) |
| Subscription detection (§9) | [src/lib/subscriptions.ts](src/lib/subscriptions.ts) |
| Reporting / is_expense (§8.1) | [src/lib/reporting.ts](src/lib/reporting.ts) |
| Dashboard views | [src/app/](src/app/) |

---

## Local setup

### 1. Prerequisites

- Node 20+ and npm.
- A Postgres database. Any works — [Neon](https://neon.tech) (free) is the easiest
  and is what you'll likely use on Vercel too. For a fully local DB:
  ```bash
  docker run -d --name mt-pg -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=moneytracker -p 5432:5432 postgres:16-alpine
  # DATABASE_URL="postgresql://postgres:pass@localhost:5432/moneytracker"
  ```

### 2. Install & configure

```bash
npm install
cp .env.example .env       # then fill in DATABASE_URL and the rest
node scripts/generate-icons.mjs   # generate PWA icons (already committed, but safe to re-run)
```

### 3. Database

```bash
npm run db:push     # create tables from the schema
npm run db:seed     # seed the category taxonomy + starter merchant rules
```

### 4. Gmail OAuth (read-only)

1. In the [Google Cloud Console](https://console.cloud.google.com): create a project,
   **enable the Gmail API**, and create **OAuth 2.0 credentials of type "Desktop app"**
   (or "Web application" — either works as long as the redirect URI matches).
2. Add an **Authorized redirect URI**:
   - Local: `http://localhost:3000/api/auth/google/callback`
   - Vercel: `https://<your-app>.vercel.app/api/auth/google/callback`
3. Put the client id/secret and redirect URI into `.env`.
4. **Move the OAuth consent screen to "In production"** (add yourself as the single
   user). While it's in "Testing", Google expires refresh tokens after ~1 week — no
   verification is needed for personal use. (Google changes this periodically; verify
   at build time.)
5. Scope is `gmail.readonly` and nothing wider — the app never writes to any account.

### 5. Run

```bash
npm run dev         # http://localhost:3000
```

Open **Settings → Connect Gmail**, authorize, then **Sync now**. Or from the CLI:

```bash
npm run sync            # fetch → parse → categorize
npm run detect-subs     # subscription detection
```

### 6. Add your banks

Bank sender addresses live in [src/config/banks.ts](src/config/banks.ts). Adding a
new bank = one entry there + a parser module in
[src/lib/parsers/](src/lib/parsers/) keyed by that bank. The **Parser health** view
surfaces unparsed emails with sample bodies so you know exactly which templates to add.

Bundled parsers: **HDFC, ICICI, SBI, Axis** (UPI / card / netbanking templates).

---

## Deploying to Vercel

Multi-user: each person signs up with email + password, connects their own Gmail,
and sees only their own data. The Google app credentials and category taxonomy are
shared (set once by you, the host).

1. **Create a Postgres database** — [Neon](https://neon.tech) (free) or Vercel
   Postgres. On Neon, copy the **pooled** connection string (host contains `-pooler`).
2. **Import the repo** into Vercel.
3. **Set Environment Variables** (Project Settings → Environment Variables):
   - `DATABASE_URL` — the pooled Postgres URL
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://<your-app>.vercel.app/api/auth/google/callback`
   - `SESSION_SECRET` — a long random string (`openssl rand -hex 32`) **[required]**
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` — optional (LLM categorization)
   - `CRON_SECRET` — a random string; Vercel sends it to `/api/cron` automatically
4. Add the redirect URI from step 3 to your **OAuth client → Authorized redirect URIs**.
5. **Deploy.** The build runs `prisma generate && next build`.
6. **Initialize the DB once** from your machine, pointed at the prod DB:
   ```bash
   DATABASE_URL="<prod-postgres-url>" npm run db:push
   DATABASE_URL="<prod-postgres-url>" npm run db:seed
   ```
7. Open the app → **Sign up** → **Settings → Connect Gmail** → **Sync now**.
   (Add each user's email as a **Test user** on the Google OAuth consent screen while
   the app is in "Testing" mode.)

**Scheduled sync:** [vercel.json](vercel.json) runs a daily cron on `/api/cron`
(for all users: fetch → parse → categorize → detect subscriptions), protected by
`CRON_SECRET`. Sub-daily crons and >60s functions need a Vercel Pro plan — run the
first large backfill locally with `DATABASE_URL="<prod>" npm run sync`.

---

## Bank SMS (Android)

Your bank sends the same alert twice — email and SMS. Gmail sync covers the
first; this covers the second, for transactions that never generate an email.

**A web app cannot read the SMS inbox.** There is no such API in any browser,
and on iOS no third-party app of any kind can do it. So the phone does that
half: an automation app that holds `READ_SMS` forwards each bank alert to
`POST /api/ingest/sms`, and from there it joins the same pipeline Gmail feeds —
same parsers, same review queue, same de-duplication. Android only.

Settings → **Bank SMS (Android)** shows your webhook URL, your ingest token and
the exact MacroDroid/Tasker steps. In short:

1. Install MacroDroid (or Tasker) and grant it SMS permission.
2. Trigger: **SMS Received**, filtered to the bank sender headers listed in
   Settings, so nothing personal ever leaves the phone.
3. Action: **HTTP POST** the JSON `{"sender": "...", "text": "..."}` to your
   `/api/ingest/sms`, with `Authorization: Bearer <your token>`.

Notes:

- The token is derived from `SESSION_SECRET`, not stored, so adding SMS needs
  **no database migration**. Rotating `SESSION_SECRET` revokes every ingest
  token (and every session) — that is the revocation path.
- Ingest is idempotent on sender + minute + text, so a retry on a flaky
  connection cannot create a second transaction.
- A bank that sends *both* an email and an SMS for one purchase still yields
  one transaction: §5.3 dedupe matches on amount + ±3 min + direction + last4,
  regardless of which source each alert came from.
- Unknown sender headers are rejected with `422` rather than stored, so a
  misconfigured macro cannot fill the database with personal messages.
- SMS templates differ from the email ones and live in
  [src/lib/parsers/sms/](src/lib/parsers/sms/); anything unrecognised shows up
  under **Parsers** instead of being dropped.

---

## Install as a mobile app (PWA)

Once deployed over HTTPS (Vercel gives you this):

There is an **Install app** button in the product itself — in the landing-page
header and hero, and in the sidebar once you are signed in. On Chrome it fires
the browser's native install prompt; on Safari and anywhere else the prompt is
unavailable, it opens step-by-step instructions for that platform. The button
hides itself once the app is already running standalone.

Manually, if you prefer:

- **Android / Chrome:** open the site → menu → **Install app** / **Add to Home screen**.
- **iOS / Safari:** Share → **Add to Home Screen**. Must be Safari — Chrome on iOS cannot install.

The app is responsive (mobile bottom-tab nav, desktop sidebar) and ships a
[manifest](public/manifest.json) + [service worker](public/sw.js) with a cached app
shell. API responses are never cached — financial data always loads live.
Installed launches open at `/dashboard`, skipping the marketing page, and the
icon's long-press menu jumps straight to Transactions or the review queue.

Installability requires HTTPS — `localhost` counts during development, but over
plain HTTP on a LAN address the browser will not offer to install.

---

## Security & privacy

- **Read-only Gmail** (`gmail.readonly`); the app never initiates or modifies any
  financial transaction.
- **Only merchant name strings** are sent to the LLM — never amounts, account
  numbers, reference IDs, dates, or email bodies. ([src/lib/llm.ts](src/lib/llm.ts))
- Account numbers are stored as **last-4 only**.
- OAuth tokens live in the DB (Vercel has no persistent disk), not in a committed file.
  `.env`, `token.json`, and credentials are gitignored.
- **Off localhost, set `APP_PASSWORD`** — the [middleware](src/middleware.ts) then
  requires a login for every page and API route. Vercel serves HTTPS automatically.
- No third-party analytics, error reporting, or telemetry.
- **Full export** (`/api/export?format=json|csv`) and **complete delete**
  (Settings → Delete all data) are built in.

---

## Testing

```bash
npm test        # parser fixtures, merchant normalization, timezone handling
```

Parser regressions are the likeliest source of silent data corruption, so each bank
template has a fixture with expected output in [tests/fixtures/](tests/fixtures/).
Add a fixture whenever you add a template. The date/time tests pin IST handling so
`occurred_at` stays correct regardless of server timezone (Vercel runs in UTC).

---

## How categorization learns

1. **Rules first** — substring match against the `merchant_rules` table (highest
   priority wins). Seeded with ~50 common Indian merchants.
2. **LLM fallback** — unknown merchants are batched into a single Claude call that
   must choose from the closed taxonomy and return a confidence.
3. **Review queue** — anything with confidence < 0.7 (or no LLM configured) lands in
   the review queue, the fastest screen in the app (one keystroke per decision).

**Every** decision — LLM or human — writes back a `merchant_rules` row, so each
unknown merchant costs at most one LLM call ever, and the rules table steadily
catches more traffic. Two correction modes (per spec §7.5):

- **"Always this merchant"** → writes a rule; optionally re-applies to past
  transactions.
- **"Just this one"** → sets + **locks** the row so the categorizer never overwrites
  your one-off (e.g. Swiggy delivery vs. Dineout under an identical merchant string).

---

## What's not built (v2+, by design)

SMS ingestion is intentionally deferred but the schema supports it drop-in
(`transactions.source`, nullable `raw_email_id`). See the build spec §11 for the
Android/iOS/no-code options and why PhonePe/GPay/Paytm and the Account Aggregator
framework are dead ends for a personal project.
