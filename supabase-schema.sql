-- Track It — Supabase schema (shared ledgers version)
-- Run this in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query).
--
-- If you're upgrading from the single-account version of this app, drop the
-- old profiles/expenses tables first (or use a fresh Supabase project) —
-- the shape changed from "one ledger per account" to "ledgers with
-- multiple members".
--
-- Data model:
--   ledgers          one row per ledger (the shared thing being tracked)
--   ledger_members   who belongs to which ledger (many-to-many)
--   ledger_invites   pending invitations by email, claimed on first sign-in
--   expenses         one row per expense, scoped to a ledger

create extension if not exists pgcrypto;

create table if not exists ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  categories jsonb not null default '[]'::jsonb,
  budgets jsonb not null default '{"overall": null, "categories": {}}'::jsonb,
  payment_methods jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
-- Safe to re-run on an existing database that predates payment methods.
alter table ledgers add column if not exists payment_methods jsonb not null default '[]'::jsonb;

create table if not exists ledger_members (
  ledger_id uuid not null references ledgers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

create table if not exists ledger_invites (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists ledger_invites_unique on ledger_invites (ledger_id, lower(email));

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  date date not null,
  category text not null,
  note text,
  amount numeric not null,
  payment_method text,
  created_at timestamptz not null default now()
);
-- Safe to re-run on an existing database that predates payment methods.
alter table expenses add column if not exists payment_method text;

create index if not exists expenses_ledger_id_idx on expenses (ledger_id);
create index if not exists expenses_ledger_date_idx on expenses (ledger_id, date);

-- Row Level Security -------------------------------------------------
-- Access is scoped by ledger_members: a user can only see/act on a ledger
-- (or its expenses) if a matching membership row exists for their own
-- auth.uid(). This is enforced by Postgres itself, not app code.

alter table ledgers enable row level security;
alter table ledger_members enable row level security;
alter table ledger_invites enable row level security;
alter table expenses enable row level security;

-- Breaks a self-referencing recursion Postgres can't resolve when a policy
-- on ledger_members queries ledger_members from within itself.
create or replace function public.is_ledger_member(check_ledger_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from ledger_members
    where ledger_id = check_ledger_id and user_id = auth.uid()
  );
$$;

create policy "select ledgers you belong to" on ledgers for select
  using (
    owner_id = auth.uid()
    or exists (select 1 from ledger_members m where m.ledger_id = ledgers.id and m.user_id = auth.uid())
  );

create policy "insert own ledger" on ledgers for insert
  with check (owner_id = auth.uid());

create policy "update ledgers you belong to" on ledgers for update
  using (exists (select 1 from ledger_members m where m.ledger_id = ledgers.id and m.user_id = auth.uid()));

-- Only the owner can delete a ledger. Everything else (memberships,
-- invites, expenses, income, recurring templates, activity log) cascades
-- automatically via the "on delete cascade" foreign keys already defined
-- above — deleting the ledgers row is enough.
create policy "owner can delete ledger" on ledgers for delete
  using (owner_id = auth.uid());

create policy "select memberships of your ledgers" on ledger_members for select
  using (public.is_ledger_member(ledger_id));

-- A user can add themself as a member either when they've just created the
-- ledger (they're its owner), or when a pending invite matches their
-- account's email.
create policy "join as ledger owner" on ledger_members for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from ledgers l where l.id = ledger_members.ledger_id and l.owner_id = auth.uid())
  );

create policy "join via invite" on ledger_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from ledger_invites i
      where i.ledger_id = ledger_members.ledger_id
      and lower(i.email) = lower(auth.jwt() ->> 'email')
    )
  );

create policy "select invites you sent, received, or can see as a member" on ledger_invites for select
  using (
    invited_by = auth.uid()
    or lower(email) = lower(auth.jwt() ->> 'email')
    or exists (select 1 from ledger_members m where m.ledger_id = ledger_invites.ledger_id and m.user_id = auth.uid())
  );

create policy "invite as a member" on ledger_invites for insert
  with check (
    invited_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = ledger_invites.ledger_id and m.user_id = auth.uid())
  );

create policy "remove invite as member or invitee" on ledger_invites for delete
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or exists (select 1 from ledger_members m where m.ledger_id = ledger_invites.ledger_id and m.user_id = auth.uid())
  );

create policy "select expenses in your ledgers" on expenses for select
  using (exists (select 1 from ledger_members m where m.ledger_id = expenses.ledger_id and m.user_id = auth.uid()));

create policy "insert expenses in your ledgers" on expenses for insert
  with check (
    added_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = expenses.ledger_id and m.user_id = auth.uid())
  );

create policy "update expenses in your ledgers" on expenses for update
  using (exists (select 1 from ledger_members m where m.ledger_id = expenses.ledger_id and m.user_id = auth.uid()));

create policy "delete expenses in your ledgers" on expenses for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = expenses.ledger_id and m.user_id = auth.uid()));

-- Income tracking -----------------------------------------------------
create table if not exists income (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  date date not null,
  source text not null,
  note text,
  amount numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists income_ledger_id_idx on income (ledger_id);
create index if not exists income_ledger_date_idx on income (ledger_id, date);

alter table income enable row level security;

create policy "select income in your ledgers" on income for select
  using (exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid()));

create policy "insert income in your ledgers" on income for insert
  with check (
    added_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid())
  );

create policy "update income in your ledgers" on income for update
  using (exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid()));

create policy "delete income in your ledgers" on income for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid()));

-- Recurring expenses ----------------------------------------------------
-- No server-side cron here — due templates are generated lazily the next
-- time any member of the ledger opens the app in a new month (see
-- generateDueRecurring in the app), tracked via last_generated_month so
-- each template only ever fires once per month.
create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  category text not null,
  note text,
  amount numeric not null,
  payment_method text,
  day_of_month integer not null default 1,
  last_generated_month text,
  created_at timestamptz not null default now()
);
create index if not exists recurring_expenses_ledger_id_idx on recurring_expenses (ledger_id);

alter table recurring_expenses enable row level security;

create policy "select recurring in your ledgers" on recurring_expenses for select
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid()));

create policy "insert recurring in your ledgers" on recurring_expenses for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid())
  );

create policy "update recurring in your ledgers" on recurring_expenses for update
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid()));

create policy "delete recurring in your ledgers" on recurring_expenses for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid()));

-- Activity log ------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  detail text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_ledger_id_idx on activity_log (ledger_id, created_at desc);

alter table activity_log enable row level security;

create policy "select activity in your ledgers" on activity_log for select
  using (exists (select 1 from ledger_members m where m.ledger_id = activity_log.ledger_id and m.user_id = auth.uid()));

create policy "insert activity in your ledgers" on activity_log for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = activity_log.ledger_id and m.user_id = auth.uid())
  );

-- Multi-currency ------------------------------------------------------
alter table ledgers add column if not exists currency text not null default 'AED';

-- Receipt photos --------------------------------------------------------
alter table expenses add column if not exists receipt_path text;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Receipt files are stored at "<ledger_id>/<expense_id>-<random>.<ext>" —
-- these policies parse the first path segment back out to check ledger
-- membership, the same access rule used everywhere else in this schema.
drop policy if exists "select receipts in your ledgers" on storage.objects;
create policy "select receipts in your ledgers" on storage.objects for select
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from ledger_members m
      where m.ledger_id = (storage.foldername(name))[1]::uuid
      and m.user_id = auth.uid()
    )
  );

drop policy if exists "insert receipts in your ledgers" on storage.objects;
create policy "insert receipts in your ledgers" on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from ledger_members m
      where m.ledger_id = (storage.foldername(name))[1]::uuid
      and m.user_id = auth.uid()
    )
  );

drop policy if exists "delete receipts in your ledgers" on storage.objects;
create policy "delete receipts in your ledgers" on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from ledger_members m
      where m.ledger_id = (storage.foldername(name))[1]::uuid
      and m.user_id = auth.uid()
    )
  );

-- Savings ---------------------------------------------------------------
-- Money logged here counts as an outflow alongside expenses when
-- calculating Net (Income - Spent - Savings) — it's tracked separately
-- from expenses so it's visible as its own line, not because it's a
-- different kind of spending.
create table if not exists savings (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  date date not null,
  note text,
  amount numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists savings_ledger_id_idx on savings (ledger_id);
create index if not exists savings_ledger_date_idx on savings (ledger_id, date);

alter table savings enable row level security;

create policy "select savings in your ledgers" on savings for select
  using (exists (select 1 from ledger_members m where m.ledger_id = savings.ledger_id and m.user_id = auth.uid()));

create policy "insert savings in your ledgers" on savings for insert
  with check (
    added_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = savings.ledger_id and m.user_id = auth.uid())
  );

create policy "delete savings in your ledgers" on savings for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = savings.ledger_id and m.user_id = auth.uid()));

-- Recurring income --------------------------------------------------------
-- Same lazy "generate on next visit" pattern as recurring_expenses — no
-- server-side cron here either.
create table if not exists recurring_income (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  source text not null,
  note text,
  amount numeric not null,
  day_of_month integer not null default 1,
  last_generated_month text,
  created_at timestamptz not null default now()
);
create index if not exists recurring_income_ledger_id_idx on recurring_income (ledger_id);

alter table recurring_income enable row level security;

create policy "select recurring income in your ledgers" on recurring_income for select
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid()));

create policy "insert recurring income in your ledgers" on recurring_income for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid())
  );

create policy "update recurring income in your ledgers" on recurring_income for update
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid()));

create policy "delete recurring income in your ledgers" on recurring_income for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid()));

-- Card payment reminders -------------------------------------------------
create table if not exists card_reminders (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  card_name text not null,
  due_day integer not null check (due_day between 1 and 31),
  note text,
  last_notified_month text,
  created_at timestamptz not null default now()
);
create index if not exists card_reminders_ledger_id_idx on card_reminders (ledger_id);

alter table card_reminders enable row level security;

create policy "select card reminders in your ledgers" on card_reminders for select
  using (exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid()));

create policy "insert card reminders in your ledgers" on card_reminders for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid())
  );

create policy "update card reminders in your ledgers" on card_reminders for update
  using (exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid()));

create policy "delete card reminders in your ledgers" on card_reminders for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid()));

-- Notifications (bell icon) -----------------------------------------------
-- Read state and the 15-item cap are shared per ledger, the same way the
-- activity log is — not tracked separately per person. Older entries are
-- deleted outright once a ledger has more than 15, not just hidden.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  message text not null,
  type text not null default 'card_due',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_ledger_id_idx on notifications (ledger_id, created_at desc);

alter table notifications enable row level security;

create policy "select notifications in your ledgers" on notifications for select
  using (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));

create policy "insert notifications in your ledgers" on notifications for insert
  with check (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));

create policy "update notifications in your ledgers" on notifications for update
  using (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));

create policy "delete notifications in your ledgers" on notifications for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));

-- Loans (given or taken) --------------------------------------------------
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  loan_type text not null,
  direction text not null check (direction in ('given', 'taken')),
  person_or_lender text,
  principal_amount numeric,
  monthly_repayment numeric,
  include_in_net_balance boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists loans_ledger_id_idx on loans (ledger_id);

alter table loans enable row level security;

create policy "select loans in your ledgers" on loans for select
  using (exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid()));

create policy "insert loans in your ledgers" on loans for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid())
  );

create policy "update loans in your ledgers" on loans for update
  using (exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid()));

create policy "delete loans in your ledgers" on loans for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid()));
