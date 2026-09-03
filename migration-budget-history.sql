-- Budget version history
--
-- Budgets were previously a single JSON value on ledgers.budgets, applying
-- identically to every month, past and future, with no history. This
-- migration adds real per-month history: each row here is "the budget
-- that took effect starting this calendar month." Reading the applicable
-- budget for any given month means picking the most recent row whose
-- effective_from is on or before that month's first day.
--
-- Run this once in the Supabase SQL Editor.

create table if not exists budget_versions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id) on delete cascade,
  effective_from date not null,
  overall numeric,
  categories jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (ledger_id, effective_from)
);

alter table budget_versions enable row level security;

-- Same access model as budgets today: any member of the ledger can view
-- and edit budgets, not just the owner (unlike ledger rename/delete).
create policy "Members can view budget versions"
  on budget_versions for select
  using (
    exists (
      select 1 from ledger_members
      where ledger_members.ledger_id = budget_versions.ledger_id
        and ledger_members.user_id = auth.uid()
    )
  );

create policy "Members can insert budget versions"
  on budget_versions for insert
  with check (
    exists (
      select 1 from ledger_members
      where ledger_members.ledger_id = budget_versions.ledger_id
        and ledger_members.user_id = auth.uid()
    )
  );

create policy "Members can update budget versions"
  on budget_versions for update
  using (
    exists (
      select 1 from ledger_members
      where ledger_members.ledger_id = budget_versions.ledger_id
        and ledger_members.user_id = auth.uid()
    )
  );

-- Backfill: carry each existing ledger's current single budget value into
-- one version effective from far in the past, so every historical month
-- keeps showing exactly what it already showed before this change. New
-- edits made after this migration will correctly create additional,
-- more recent versions instead of overwriting this one.
insert into budget_versions (ledger_id, effective_from, overall, categories)
select
  id,
  '2000-01-01',
  (budgets->>'overall')::numeric,
  coalesce(budgets->'categories', '{}'::jsonb)
from ledgers
where budgets is not null
on conflict (ledger_id, effective_from) do nothing;
