-- Run this once in Supabase's SQL Editor against your EXISTING database.
-- Adds savings tracking and recurring income. Safe to run even if part of
-- it is already applied.

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

drop policy if exists "select savings in your ledgers" on savings;
create policy "select savings in your ledgers" on savings for select
  using (exists (select 1 from ledger_members m where m.ledger_id = savings.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert savings in your ledgers" on savings;
create policy "insert savings in your ledgers" on savings for insert
  with check (
    added_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = savings.ledger_id and m.user_id = auth.uid())
  );

drop policy if exists "delete savings in your ledgers" on savings;
create policy "delete savings in your ledgers" on savings for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = savings.ledger_id and m.user_id = auth.uid()));

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

drop policy if exists "select recurring income in your ledgers" on recurring_income;
create policy "select recurring income in your ledgers" on recurring_income for select
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert recurring income in your ledgers" on recurring_income;
create policy "insert recurring income in your ledgers" on recurring_income for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid())
  );

drop policy if exists "delete recurring income in your ledgers" on recurring_income;
create policy "delete recurring income in your ledgers" on recurring_income for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_income.ledger_id and m.user_id = auth.uid()));
