-- Run this once in Supabase's SQL Editor against your EXISTING database.
-- Adds loan tracking (given or taken). Safe to run even if part of it is
-- already applied.

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

drop policy if exists "select loans in your ledgers" on loans;
create policy "select loans in your ledgers" on loans for select
  using (exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert loans in your ledgers" on loans;
create policy "insert loans in your ledgers" on loans for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid())
  );

drop policy if exists "update loans in your ledgers" on loans;
create policy "update loans in your ledgers" on loans for update
  using (exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid()));

drop policy if exists "delete loans in your ledgers" on loans;
create policy "delete loans in your ledgers" on loans for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = loans.ledger_id and m.user_id = auth.uid()));

-- Run this too if you already applied the migration above before this fix —
-- adds the repayment start date needed to know when a loan is paid off.
alter table loans add column if not exists start_date date not null default current_date;
