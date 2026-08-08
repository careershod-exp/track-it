-- Run this once in Supabase's SQL Editor against your EXISTING database to
-- add income tracking and recurring expenses. Safe to run even if you're
-- not sure whether part of it is already applied.

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

drop policy if exists "select income in your ledgers" on income;
create policy "select income in your ledgers" on income for select
  using (exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert income in your ledgers" on income;
create policy "insert income in your ledgers" on income for insert
  with check (
    added_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid())
  );

drop policy if exists "update income in your ledgers" on income;
create policy "update income in your ledgers" on income for update
  using (exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid()));

drop policy if exists "delete income in your ledgers" on income;
create policy "delete income in your ledgers" on income for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = income.ledger_id and m.user_id = auth.uid()));

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

drop policy if exists "select recurring in your ledgers" on recurring_expenses;
create policy "select recurring in your ledgers" on recurring_expenses for select
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert recurring in your ledgers" on recurring_expenses;
create policy "insert recurring in your ledgers" on recurring_expenses for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid())
  );

drop policy if exists "update recurring in your ledgers" on recurring_expenses;
create policy "update recurring in your ledgers" on recurring_expenses for update
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid()));

drop policy if exists "delete recurring in your ledgers" on recurring_expenses;
create policy "delete recurring in your ledgers" on recurring_expenses for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = recurring_expenses.ledger_id and m.user_id = auth.uid()));
