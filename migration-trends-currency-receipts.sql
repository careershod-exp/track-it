-- Run this once in Supabase's SQL Editor against your EXISTING database.
-- Adds: activity log, multi-currency, and receipt photo storage.
-- Safe to run even if part of it is already applied.

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

drop policy if exists "select activity in your ledgers" on activity_log;
create policy "select activity in your ledgers" on activity_log for select
  using (exists (select 1 from ledger_members m where m.ledger_id = activity_log.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert activity in your ledgers" on activity_log;
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
