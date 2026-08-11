-- Run this once in Supabase's SQL Editor against your EXISTING database.
-- Adds credit card due-date tracking and the notification bell. Safe to
-- run even if part of it is already applied.

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

drop policy if exists "select card reminders in your ledgers" on card_reminders;
create policy "select card reminders in your ledgers" on card_reminders for select
  using (exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert card reminders in your ledgers" on card_reminders;
create policy "insert card reminders in your ledgers" on card_reminders for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid())
  );

drop policy if exists "update card reminders in your ledgers" on card_reminders;
create policy "update card reminders in your ledgers" on card_reminders for update
  using (exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid()));

drop policy if exists "delete card reminders in your ledgers" on card_reminders;
create policy "delete card reminders in your ledgers" on card_reminders for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = card_reminders.ledger_id and m.user_id = auth.uid()));

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

drop policy if exists "select notifications in your ledgers" on notifications;
create policy "select notifications in your ledgers" on notifications for select
  using (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));

drop policy if exists "insert notifications in your ledgers" on notifications;
create policy "insert notifications in your ledgers" on notifications for insert
  with check (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));

drop policy if exists "update notifications in your ledgers" on notifications;
create policy "update notifications in your ledgers" on notifications for update
  using (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));

drop policy if exists "delete notifications in your ledgers" on notifications;
create policy "delete notifications in your ledgers" on notifications for delete
  using (exists (select 1 from ledger_members m where m.ledger_id = notifications.ledger_id and m.user_id = auth.uid()));
