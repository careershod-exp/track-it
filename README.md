# Track It

A shared expense tracker with income tracking, budgets, recurring expenses,
receipt photos, offline support, 2FA, and CSV bank import. This is a real,
standalone React app (not a Claude artifact) backed by Supabase, with real
per-person accounts and invite-based access to shared ledgers.

## 1. Create a Supabase project

1. Go to https://supabase.com, sign up / log in, and create a new project.
2. Open **SQL Editor** in the left sidebar, paste in the full contents of
   `supabase-schema.sql` (included in this project), and run it. This
   creates every table this app uses and the Row Level Security policies
   that enforce who can see or change what — safe to run in full on a
   brand-new project.
3. Open **Authentication -> Providers** and confirm **Email** is enabled
   (it is by default).
4. Under **Authentication -> Settings**, decide whether to require email
   confirmation for new sign-ups (on by default — recommended once you're
   sharing this with real people, can be off for faster local testing).
5. Under **Authentication -> Rate Limits**, raise the email send limit if
   you plan to use "Forgot password" for real — Supabase's own email
   sender is capped very low by default. Configuring a free custom SMTP
   provider (Brevo, Resend, etc) under **Authentication -> Settings ->
   SMTP Settings** removes that limit entirely.
6. Open **Project Settings -> API** and copy your **Project URL** and
   **anon public** key.

### Upgrading an existing database instead of starting fresh?

Run these migrations in order in the SQL Editor — each is safe to run even
if part of it is already applied:
1. `migration-payment-methods.sql`
2. `migration-income-recurring.sql`
3. `migration-trends-currency-receipts.sql`

(2FA and CSV import need no migration — 2FA is entirely a Supabase Auth
feature, and CSV import writes through the same `expenses` table as
manual entry.)

## Set up invite emails (optional but recommended)

Without this step, inviting someone still works — it just doesn't email
them, so you'd need to tell them yourself. To make it send a real email:

1. Make sure you already have Brevo (or another SMTP provider) set up per
   step 5 above, with a verified sender address.
2. In Supabase, go to **Edge Functions** in the left sidebar -> **Deploy a
   new function** -> **Via Editor**.
3. Name it exactly `send-invite-email`.
4. Open `supabase/functions/send-invite-email/index.ts` from this project
   in a text editor, copy its entire contents, and paste them into
   Supabase's editor, replacing whatever template code is there.
5. If your Brevo sender address isn't `trackituae.com@gmail.com`, change
   the `FROM_EMAIL` line near the top to match yours. Also double check
   `APP_URL` points at your real deployed domain.
6. Click **Deploy**.
7. Go to **Edge Functions -> Manage secrets** (or the secrets tab on the
   function itself) and add a secret named `BREVO_API_KEY` with your
   Brevo SMTP/API key (Brevo -> SMTP & API -> API Keys — this is a
   different value from the SMTP password you used in step 5).
8. Test it by inviting yourself to a ledger with a different email address
   you own — you should get the email within a minute or two.

No CLI or Docker needed for any of this — it's all done through Supabase's
dashboard.

## 2. Configure the app

```bash
cp .env.example .env
```

Fill in `.env` with your Project URL and anon key.

## 3. Run it locally

```bash
npm install
npm run dev
```

Create an account, add some expenses, then click the people icon in the
header to invite someone else by email.

## 4. Deploy it

Push to GitHub, import into **Vercel** or **Netlify**, add the same two
env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in their project
settings, and deploy. Once deployed, update Supabase's **Authentication ->
URL Configuration -> Site URL** to your real domain — "Forgot password"
and email confirmation links are built from that setting.

## 5. Test the install prompt

Visit your live URL on a phone or desktop Chrome/Edge — you should see an
install icon in the address bar, or an "Add to Home Screen" option in the
browser's share/menu sheet.

## Features

**Accounts & access**
- Real email/password accounts with forgot-password email flow
- Optional 2FA (TOTP via any authenticator app) — Settings -> "Turn on
  two-factor authentication". Enforced at the session level (checked
  before any ledger data loads), not just a UI toggle. If someone's
  locked out, remove it from Supabase's dashboard: **Authentication ->
  Users -> ⋮ next to that user -> Remove MFA Factors**.
- Multiple ledgers per account, switchable from the header, each with
  fully separate data
- Shared ledgers — invite people by email from the people icon; they get
  a real invite email (see "Set up invite emails" below) and are added
  automatically the moment they sign up or sign in with that address. If
  the email step isn't set up yet, the invite still works — you'd just
  need to tell them yourself to sign up.
- Settings panel: email, ledger name, currency, 2FA, change password
  (requires the current password, re-verified against Supabase, before a
  change is applied)

**Tracking**
- Expenses with category, note, date, optional payment method, optional
  receipt photo (max 8MB, private per ledger via Supabase Storage)
- Income tracking alongside expenses, with a Spent / Income / Net summary
- Recurring expenses (rent, subscriptions) — generated automatically once
  a month, the first time anyone opens the ledger after the month starts
  (no server-side scheduler, so this is "generate on next visit" rather
  than exact-date automation)
- CSV bank import — map date/description/amount columns from a CSV
  export (not PDF — unreliable to parse reliably compared to CSV), preview
  before importing. Only those three fields are ever read; the file
  itself never leaves the browser
- Payment methods with automatic icons based on the nickname (cards, cash,
  bank transfer, etc); the form always warns against entering real card
  numbers or CVVs
- Multi-currency (12 common currencies) — display-only, no exchange-rate
  conversion
- Undo delete (5-second window), search across notes/categories/payment
  methods, an auto-scrolling "news ticker" of recent activity

**Insight**
- Monthly budgets (overall + per-category) with browser-notification
  alerts when exceeded (only while the app is open — true background push
  would need server infrastructure beyond this project)
- 12-month spending vs. income trend chart
- Activity log — who added/edited/deleted what, most recent first
- PDF and CSV export (single download menu, both include payment method)

**Offline**
- Already-loaded data stays visible with no connection
- New expenses/income can still be added — queued locally, synced
  automatically once back online (or via a manual "Sync now" button)
- Deliberately blocked offline: editing or deleting an already-synced
  item, adding a new category/payment method, budgets, currency,
  recurring expenses, CSV import, invites — anything that touches data
  shared with other members, since two people editing the same shared
  field while both offline could silently overwrite each other. Each
  shows a clear "needs an internet connection" message instead of failing
  silently.

## Design notes

The visual identity (forest green, gold, parchment cards, receipt-tape and
ledger motifs) is intentional and consistent throughout — cards and modals
use real shadows for depth, the header's icon row is a grouped toolbar
rather than loose floating buttons, list rows and icon buttons highlight on
hover, and the whole page is locked from horizontally overflowing on
narrow phones (a real bug from an earlier version, where a growing icon
row could make the entire page pan sideways like a webpage instead of
sitting fixed like an app).

## How shared ledgers work

- Every account belongs to at least one ledger. The **first person to
  sign up owns that ledger** and can invite others to it by email.
- An invite is stored as a pending row until the invited person signs up
  or signs in with that exact email — at that point they're automatically
  added as a member and see the same shared ledger, same expenses, same
  budgets.
- If someone signs up *before* being invited, they get their own ledger.
  Being invited afterward doesn't merge ledgers — worth knowing if you
  invite an existing user with expenses already in their own ledger;
  their existing ledger isn't deleted, it's just not where they'll land
  after accepting.
- Everything is enforced by **Row Level Security** in Postgres itself
  (see `supabase-schema.sql`) — a signed-in user's requests are checked
  against `ledger_members` on every read and write. Even direct API
  access with your public anon key can't reach a ledger someone isn't a
  member of.

## Project structure

```
src/
  App.jsx             the whole UI
  store.js            every Supabase call the app makes, in one place
  supabaseClient.js    Supabase client setup, reads .env vars
  main.jsx            React entry point
public/               PWA icons and favicon
supabase-schema.sql    full schema — run this on a brand-new project
migration-*.sql        incremental migrations for upgrading an existing database
```

## Notes on how data works

- **Ledger** (name, categories, budgets, payment methods, currency) lives
  in the `ledgers` table.
- **Membership** lives in `ledger_members` — a many-to-many join between
  accounts and ledgers, with a `display_name` cached at join time so
  member lists don't need to query `auth.users` directly.
- **Pending invites** live in `ledger_invites` until claimed or cancelled.
- **Expenses**, **income**, and **recurring_expenses** each live in their
  own table, scoped by `ledger_id`.
- **activity_log** records who did what, for the activity log viewer.
- **Receipt photos** live in a private Supabase Storage bucket
  (`receipts`), one file per expense, deleted when the expense is deleted.
- **The "Demo" login is local-only** — it never touches Supabase, requires
  no account, and its data disappears on logout or reload. Offline
  support, receipt photos, 2FA, and CSV import are all unavailable in
  demo mode since they need a real account/database.
